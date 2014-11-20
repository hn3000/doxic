/// <reference path="typings/tsd.d.ts" />

import path = require('path');
import fs   = require('fs-extra');
import cm   = require('commonmark');
import _    = require('underscore');

var highlightjs = require('highlight.js');

module doxic {

    export interface ILanguageEntry {
        name: string;
        label?: string;
        literate?: boolean;
        //commentOptions?: string;
        commentLine?: string;
        commentBlock?: {
            start: string;
            end: string;
        };
    }

    export interface ILanguageSpecs {
        [key:string]: ILanguageEntry;
    }

    export interface ISourceEntry {
        language: ILanguageEntry;
        filename: string;
    }

    export interface IOptions {
        parser: string; // 'commonmark', 'adhoc' (Markdown) or 'language' (separate into blocks using comments)
        layout: string;
        output: string;
        template?: string;
        suffix?:string;
        css?: string;
        public?: string;
        language?: string;
        languages?: string;
        commonmark?: string;

        debug?:string;

        // ----
        languageSpecs?: ILanguageSpecs;
        templateFun?: (...args:any[])=>string;
        _?: string[];
        sources?: ISourceEntry[];
    }

    var DEFAULTS:IOptions = {
        parser: 'commonmark',
        layout: 'parallel',
        output: 'docs',
        template: null,
        css: null,
        language:null,
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

    function findLanguage(filename:string, options:IOptions) {
        var langKey = options.language || path.extname(filename) || path.basename(filename);

        var lang = lang = options.languageSpecs[langKey];

        if (lang && lang.literate) {
            var codeKey = path.extname(path.basename(filename, langKey));
            var codeLang;
            if (codeKey && (codeLang = options.languageSpecs[codeKey])) {
                lang = _.extend({}, codeLang, { literate: true });
            }
        } else {
            console.log('no language found for ', filename);
        }

        return lang;
    }

    function findLanguageForName(name:string, options) {
        var specs = options.languageSpecs;
        for (var i in  specs) {
            if (specs.hasOwnProperty(i) && specs[i].name == name) {
                return specs[i];
            }
        }
        return null;
    }

    function configure(options:IOptions) {
        var languageFileName;
        if (options.languages) {
            languageFileName = options.languages;
        } else {
            languageFileName = path.join(__dirname, 'resources', 'languages.json');
        }
        if (fs.existsSync(languageFileName)) {
            var languageFile = fs.readFileSync(languageFileName);
            var languageSpecs = JSON.parse(languageFile.toString());
            options.languageSpecs = <ILanguageSpecs>languageSpecs;
        }

        if (options.layout) {
            var layoutDir = path.join(__dirname, 'resources', options.layout);

            options.template = path.join(layoutDir, 'docco.jst');
            options.css = path.join(layoutDir, 'docco.css');
            options.public = path.join(layoutDir, 'public');
        } else if (options.template) {
            var templateDir = path.dirname(options.template);
            var infoFile = path.join(templateDir, path.basename(options.template)+'info.json');
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

        options.sources = options._.map((src:string) => {
            var lang = findLanguage(src, options);
            if (!lang) {
                console.log("can't find language for "+src+" -- ignoring file");
                return null;
            }
            return {
                language: lang,
                filename: src
            };
        }).filter((x)=>(x != null));

    }

    function progressReporter(e:string) {
        if (e != null) {
            throw new Error(e);
        }
    }

    interface ProgressCallback {
        (x?:any):void
    }

    export function execute(options:IOptions, progressFun?:(e?:any)=>void) {
        var progress = progressFun || progressReporter;

        configure(options);

        if (options.debug) {
            console.dir(options);
        }

        if (options.sources.length == 0) {
            progress("nothing to do");
        } else {

            if (!fs.existsSync(options.output)) {
                fs.mkdirsSync(options.output);
            }

            var sources = options.sources.slice();

            processNextFile(sources);
        }

        function copyAsset(file, callback:ProgressCallback) {
            fs.exists(file, (exists, error?)=>{
                if (error) {
                    callback(error);
                } else if (exists) {
                    var target = path.join(options.output, path.basename(file));
                    fs.copy(file, target, callback);
                } else {
                    callback();
                }
            });
        }

        function copyCSS(callback) {
            if (options.css) {
                copyAsset(options.css, callback);
            } else {
                callback();
            }
        }

        function copyPublic(callback) {
            if (options.public) {
                copyAsset(options.public, callback);
            } else {
                callback();
            }
        }

        function complete() {
            copyCSS((error?)=>{
                if (error) {
                    progress(error)
                } else {
                    copyPublic(progress)
                }
            });
        }

        function processNextFile(sources:ISourceEntry[]) {
            var thisOne = sources.shift();
            fs.readFile(thisOne.filename, (error?, buffer?)=>{
                if (error) {
                    progress(error);
                } else {
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
                    } else {
                        complete();
                    }
                }
            });
        }
    }

    export interface ISection {
        docsBlocks?: cm.Block[];
        codeBlock?: cm.Block;
        codeInfo?: string;
        codeLang?: ILanguageEntry;
        codeFlags?:any;
        docsText?: string;
        codeText?: string;
        docsHtml?:string;
        codeHtml?:string;
    }

    var infoRE = /^(.*?)\s*({.*})?$/;

    function parseCommonMark(src:ISourceEntry, code:string, options:IOptions):ISection[] {
        var result:ISection[] = [];

        var reader = new cm.DocParser();

        var doc = reader.parse(code);
        var blocks = doc.children;

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
                    codeOptions = eval('('+m[2]+')');
                }
            }

            result.push({
                docsBlocks:docsBlocks,
                codeBlock:codeBlock,
                codeLang: codeLang,
                codeOptions: codeOptions || {}
            });
            codeBlock = null;
            docsBlocks = [];
        }


        for (var i=0,n=blocks.length; i < n ;++i) {
            switch (blocks[i].t) {
                case 'FencedCode':
                case 'IndentedCode':
                    codeBlock = blocks[i];
                    saveSection();
                    break;
                case 'ATXHeader':
                case 'SetextHeader':
                case 'HorizontalRule':
                    docsBlocks.push(blocks[i]);
                    saveSection();
                    break;
                default:
                    docsBlocks.push(blocks[i]);
                    break;
            }
        }
        saveSection();

        return result;
    }

    function parseAdhocMarkdown(src:ISourceEntry, code:string, options):ISection[] {
        // ...
        return [];
    }

    function parseLanguage(src:ISourceEntry, code:string, options):ISection[] {
        // ...
        return [];
    }

    function parse(src:ISourceEntry, code:string, options):ISection[] {
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

    function validLanguage(lang:string) {
        if(highlightjs.getLanguage(lang)) {
            return true;
        }
        return false;
    }

    function format(src:ISourceEntry, sections:ISection[], options:IOptions) {
        var htmlRenderer = new cm.HtmlRenderer();
        var docParser = new cm.DocParser();

        for (var i=0, n=sections.length; i < n; ++i) {
            var thisSection = sections[i];

            if (thisSection.codeBlock) {
                var block = thisSection.codeBlock;
                var code = block.string_content;

                thisSection.codeText = code;

                var lang = (block.info ? block.info.split(' ')[0] : src.language.name);
                if (!validLanguage(lang)) {
                    lang = src.language.name;
                }
                if (validLanguage(lang)) {
                    var html = highlightjs.highlight(lang, code).value;
                    thisSection.codeHtml = '<pre><code class="language-'+lang+'">'+html+'</code></pre>';
                } else {
                    if (options.debug) {
                        console.log("not highlighting code: ", src, block);
                    }
                    thisSection.codeHtml = htmlRenderer.render(block);
                }
            } else {
                thisSection.codeText = '';
            }

            if (thisSection.docsBlocks.length) {
                thisSection.docsHtml = htmlRenderer.renderBlocks(thisSection.docsBlocks);
                thisSection.docsText = ''; // TODO: render the commonmark stuff as text?
            } else if (thisSection.docsText) {
                var parsed = docParser.parse(thisSection.docsText);
                thisSection.docsHtml = htmlRenderer.render(parsed);
            } else {
                thisSection.docsHtml = '';
            }
        }
    }

    function write(src:ISourceEntry, sections:ISection[], options:IOptions) {
        var title = '';
        var hasTitle = false;

        var html = options.templateFun({
            sources: options.sources.map((e)=>e.filename),
            css: path.basename(options.css),
            title: title,
            hasTitle: hasTitle,
            sections: sections,
            path: path,
            destination: destination
        });

        var targetFileName = destination(src.filename);
        fs.writeFileSync(targetFileName, html);

        console.log('doxic: '+src.filename+' -> '+targetFileName);

        function destination(filename) {
            return path.join(options.output, filename+options.suffix);
        }

    }

    export function main(argsParam?:string[]) {
        var args = argsParam != null ?  argsParam : process.argv.slice(2);
        var argv:IOptions = require('minimist')(args, {
            default:DEFAULTS,
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
}

export = doxic;
