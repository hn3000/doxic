
declare module 'commonmark' {
  export interface InlineBlock {

  }

  export interface Block {
    t:string;
    children?: Block[];
    inline_content?: InlineBlock[];
    string_content?:string;
    info?: string;
  }
  export class DocParser {
    parse(s:string):Block;
  }
  export class HtmlRenderer {
    render(ast:Block):string;
    renderBlock(ast:Block):string;
    renderBlocks(ast:Block[]):string;
    renderInline(ast:InlineBlock):string;
    renderInline(ast:InlineBlock[]):string;
  }
  export function ASTRenderer(ast:any):string;
}
