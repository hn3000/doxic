"use strict";
var path = require("path");
var fs = require("fs-extra");
var cm = require("commonmark");
var _ = require("underscore");
var fg = require("fast-glob");
var highlightjs = require('highlight.js');
var doxic;
(function (doxic) {
    var DEFAULTS = {
        parser: 'commonmark',
        layout: 'parallel',
        output: 'docs',
        template: null,
        css: null,
        language: null,
        languages: null,
        languageSpecs: {
            ".html": {
                name: 'html',
                commentBlock: { start: '<!--', end: '-->' }
            },
            ".js": {
                name: 'javascript',
                commentLine: '//',
                commentBlock: { start: '/*', end: '*/' }
            },
            ".ts": {
                name: 'typescript',
                commentLine: '//',
                commentBlock: { start: '/*', end: '*/' }
            },
            ".md": {
                name: 'Markdown',
                literate: true
            }
        },
        commonmark: null
    };
    function findLanguage(filename, options) {
        var langKey = options.language || path.extname(filename) || path.basename(filename);
        var lang = lang = options.languageSpecs[langKey];
        if (lang && lang.literate) {
            var codeKey = path.extname(path.basename(filename, langKey));
            var codeLang;
            if (codeKey && (codeLang = options.languageSpecs[codeKey])) {
                lang = _.extend({}, codeLang, { literate: true });
            }
        }
        else {
            console.log('no language found for ', filename);
        }
        return lang;
    }
    function findLanguageForName(name, options) {
        var specs = options.languageSpecs;
        for (var i in specs) {
            if (specs.hasOwnProperty(i) && specs[i].name == name) {
                return specs[i];
            }
        }
        return null;
    }
    function configure(options) {
        var languageFileName;
        if (options.languages) {
            languageFileName = options.languages;
        }
        else {
            languageFileName = path.join(__dirname, '../resources', 'languages.json');
        }
        if (fs.existsSync(languageFileName)) {
            var languageFile = fs.readFileSync(languageFileName);
            var languageSpecs = JSON.parse(languageFile.toString());
            options.languageSpecs = languageSpecs;
        }
        if (options.layout) {
            var layoutDir = path.join(__dirname, '../resources', options.layout);
            options.template = path.join(layoutDir, 'docco.jst');
            options.css = path.join(layoutDir, 'docco.css');
            options.public = path.join(layoutDir, 'public');
        }
        else if (options.template) {
            var templateDir = path.dirname(options.template);
            var infoFile = path.join(templateDir, path.basename(options.template) + 'info.json');
            if (fs.existsSync(infoFile)) {
                var infoContents = fs.readFileSync(infoFile);
                if (infoContents) {
                    var info = JSON.parse(infoContents.toString());
                    options.suffix = info.suffix;
                    if (null == options.css) {
                        options.css = info.css;
                    }
                    if (null == options.public) {
                        options.public = info.public;
                    }
                }
            }
            if (null == options.css) {
                options.css = path.join(templateDir, 'docco.css');
            }
            if (null == options.public) {
                options.public = path.join(templateDir, 'public');
            }
        }
        if (!options.suffix) {
            options.suffix = '.html';
        }
        var templateFile = fs.readFileSync(options.template);
        options.templateFun = _.template(templateFile.toString());
        var sources = fg.sync(options._);
        options.sources = sources.map(function (src) {
            var lang = findLanguage(src, options);
            if (!lang) {
                console.log("can't find language for " + src + " -- ignoring file");
                return null;
            }
            return {
                language: lang,
                filename: src
            };
        }).filter(function (x) { return (x != null); });
    }
    function progressReporter(e) {
        if (e != null) {
            throw new Error(e);
        }
    }
    function execute(options, progressFun) {
        var progress = progressFun || progressReporter;
        configure(options);
        if (options.debug) {
            console.dir(options);
        }
        if (options.sources.length == 0) {
            progress("nothing to do");
        }
        else {
            if (!fs.existsSync(options.output)) {
                fs.mkdirsSync(options.output);
            }
            var sources = options.sources.slice();
            processNextFile(sources);
        }
        function copyAsset(file, callback) {
            fs.exists(file, function (exists, error) {
                if (error) {
                    callback(error);
                }
                else if (exists) {
                    var target = path.join(options.output, path.basename(file));
                    fs.copy(file, target, callback);
                }
                else {
                    callback();
                }
            });
        }
        function copyCSS(callback) {
            if (options.css) {
                copyAsset(options.css, callback);
            }
            else {
                callback();
            }
        }
        function copyPublic(callback) {
            if (options.public) {
                copyAsset(options.public, callback);
            }
            else {
                callback();
            }
        }
        function complete() {
            copyCSS(function (error) {
                if (error) {
                    progress(error);
                }
                else {
                    copyPublic(progress);
                }
            });
        }
        function processNextFile(sources) {
            var thisOne = sources.shift();
            fs.readFile(thisOne.filename, function (error, buffer) {
                if (error) {
                    progress(error);
                }
                else {
                    var code = buffer.toString();
                    var sections = parse(thisOne, code, options);
                    if (options.debug) {
                        console.dir(sections);
                    }
                    format(thisOne, sections, options);
                    if (options.debug) {
                        console.dir(sections);
                    }
                    write(thisOne, sections, options);
                    if (sources.length) {
                        processNextFile(sources);
                    }
                    else {
                        complete();
                    }
                }
            });
        }
    }
    doxic.execute = execute;
    var infoRE = /^(.*?)\s*({.*})?$/;
    function parseCommonMark(src, code, options) {
        var result = [];
        var parser = new cm.Parser();
        var doc = parser.parse(code);
        var codeBlock = null;
        var docsBlocks = [];
        function saveSection() {
            var codeLang = null;
            var codeOptions = null;
            if (codeBlock && codeBlock.info) {
                var m = infoRE.exec(codeBlock.info);
                if (m[1]) {
                    codeLang = findLanguageForName(m[1], options);
                }
                if (m[2]) {
                    codeOptions = eval('(' + m[2] + ')');
                }
            }
            result.push({
                docsBlocks: docsBlocks,
                codeBlock: codeBlock,
                codeLang: codeLang,
                codeOptions: codeOptions || {}
            });
            codeBlock = null;
            docsBlocks = [];
        }
        for (var node = doc.firstChild; node = node.next; node) {
            switch (node.type) {
                case 'code':
                case 'code_block':
                    codeBlock = node;
                    saveSection();
                    break;
                case 'heading':
                    docsBlocks.push(node);
                    saveSection();
                    break;
                case 'thematic_break':
                    docsBlocks.push(node);
                    saveSection();
                    break;
                default:
                    docsBlocks.push(node);
                    break;
            }
        }
        saveSection();
        return result;
    }
    function parseAdhocMarkdown(src, code, options) {
        // ...
        return [];
    }
    function parseLanguage(src, code, options) {
        // ...
        return [];
    }
    function parse(src, code, options) {
        var parser = options.parser;
        if (parser == 'language' && src.language.literate) {
            parser = 'adhoc';
        }
        switch (parser) {
            default:
            case 'commonmark': return parseCommonMark(src, code, options);
            case 'adhoc': return parseAdhocMarkdown(src, code, options);
            case 'language': return parseLanguage(src, code, options);
        }
    }
    function validLanguage(lang) {
        if (highlightjs.getLanguage(lang)) {
            return true;
        }
        return false;
    }
    function format(src, sections, options) {
        var htmlRenderer = new cm.HtmlRenderer();
        var _loop_1 = function () {
            thisSection = sections[i];
            if (thisSection.codeBlock) {
                block = thisSection.codeBlock;
                code = block.literal;
                thisSection.codeText = code;
                lang = (block.info ? block.info.split(' ')[0] : src.language.name);
                if (!validLanguage(lang)) {
                    lang = src.language.name;
                }
                if (validLanguage(lang)) {
                    html = highlightjs.highlight(lang, code).value;
                    thisSection.codeHtml = '<pre><code class="language-' + lang + '">' + html + '</code></pre>';
                }
                else {
                    if (options.debug) {
                        console.log("not highlighting code: ", src, block);
                    }
                    thisSection.codeHtml = htmlRenderer.render(block);
                }
            }
            else {
                thisSection.codeText = '';
            }
            if (thisSection.docsBlocks.length) {
                var docsNode_1 = new cm.Node('custom_block', [[0, 0], [0, 0]]);
                thisSection.docsBlocks.forEach(function (x) { return docsNode_1.appendChild(x); });
                thisSection.docsHtml = htmlRenderer.render(docsNode_1);
                thisSection.docsText = ''; // TODO: render the commonmark stuff as text?
            }
            else if (thisSection.docsText) {
                console.log('unexpected docsText');
            }
            else {
                thisSection.docsHtml = '';
            }
        };
        var thisSection, block, code, lang, html;
        for (var i = 0, n = sections.length; i < n; ++i) {
            _loop_1();
        }
    }
    function write(src, sections, options) {
        var title = '';
        var hasTitle = false;
        var html = options.templateFun({
            sources: options.sources.map(function (e) { return e.filename; }),
            css: path.basename(options.css),
            title: title,
            hasTitle: hasTitle,
            sections: sections,
            path: path,
            destination: destination
        });
        var targetFileName = destination(src.filename);
        fs.writeFileSync(targetFileName, html);
        console.log('doxic: ' + src.filename + ' -> ' + targetFileName);
        function destination(filename) {
            return path.join(options.output, filename + options.suffix);
        }
    }
    function main(argsParam) {
        var args = argsParam != null ? argsParam : process.argv.slice(2);
        var argv = require('minimist')(args, {
            "default": DEFAULTS,
            aliases: {
                languages: 'L',
                layout: 'l',
                output: 'o',
                css: 'c',
                template: 't',
                language: 'e',
                commonmark: 'm'
            }
        });
        execute(argv);
    }
    doxic.main = main;
})(doxic || (doxic = {}));
module.exports = doxic;
//# sourceMappingURL=index.js.map