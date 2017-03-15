/// <reference path="metron.extenders.ts" />

namespace metron {
    export namespace templates {
        export namespace list {
            export function row<T>(template: string, item: T): string {
                function formatOptions(attr: string): any {
                    var pairs = attr.split(";");
                    if (pairs[pairs.length - 1].trim() == ";") {
                        pairs.pop();
                    }
                    var result = "";
                    for (let i = 0; i < pairs.length; i++) {
                        let p = pairs[i].split(":");
                        try {
                            result += `"${p[0].trim()}":"${p[1].trim()}"`;
                            if (i != (pairs.length - 1)) {
                                result += ",";
                            }
                        }
                        catch (e) {
                            throw new Error("Error: Invalid key/value pair!");
                        }
                    }
                    var response = null;
                    try {
                        response = JSON.parse(`{${result}}`);
                    }
                    catch (e) {
                        throw new Error("Error: Invalid JSON for options!");
                    }
                    return response;
                }
                var result = template;
                for (let k in item) {
                    if (item.hasOwnProperty(k)) {
                        let replacement = `{{${k}}}`;
                        result = result.replace(new RegExp(replacement, "g"), (<string><any>item[k] != null && <string><any>item[k] != "null") ? <string><any>item[k] : "");
                    }
                }
                var doc = document.createElement("tr");
                doc.innerHTML = result;
                doc.selectAll("[data-m-format]").each((idx: number, elem: HTMLElement) => {
                    let options = (elem.attribute("data-m-options") != null) ? formatOptions(elem.attribute("data-m-options")) : null;
                    elem.innerText = format(elem.attribute("data-m-format"), elem.innerText, options);
                });
                return doc.innerHTML;
            }
            export function format(type: string, val: string, options?: any): string {
                function formatMessage(message: string, length?: number): string {
                    if (message != null) {
                        let len = (length != null && length > 0) ? length : 15;
                        if (message.split(" ").length > len) {
                            return message.truncateWords(len) + '...';
                        }
                    }
                    return message;
                }
                function formatDate(datetime: string): string {
                    if (datetime != null) {
                        let d = new Date(datetime);
                        let m = d.getMonth() + 1;
                        let mm = m < 10 ? "0" + m : m;
                        let dd = d.getDay();
                        let ddd = dd < 10 ? "0" + dd : dd;
                        let y = d.getFullYear();
                        let time = formatTime(d);
                        return `${mm}-${ddd}-${y} ${time}`;
                    }
                    return "";
                }
                function formatTime(datetime: Date): string {
                    var h = datetime.getHours();
                    var m = datetime.getMinutes();
                    var ampm = h >= 12 ? "pm" : "am";
                    h = h % 12;
                    h = h ? h : 12;
                    var mm = m < 10 ? "0" + m : m;
                    var result = `${h}:${mm} ${ampm}`;
                    return result;
                }
                function formatBoolean(b: boolean): string {
                    if (b) {
                        return "yes";
                    }
                    return "no";
                }
                switch (type.lower()) {
                    case "yesno":
                        return formatBoolean(<boolean><any>val);
                    case "datetime":
                        return formatDate(val);
                    case "time":
                        return formatTime(<Date><any>val);
                    case "formatMessage":
                        return formatMessage(val, options["length"]);
                    default:
                        return metron.globals[type](val, options);
                }
            }
        }
        export namespace markdown {
            export function toHTML(src: string): string { //Adapted from Mathieu 'p01' Henri: https://github.com/p01/mmd.js/blob/master/mmd.js
                let html: string = "";
                function escape(text: string): string {
                    return new Option(text).innerHTML;
                }
                function inlineEscape(str: string) {
                    return escape(str)
                        .replace(/!\[([^\]]*)]\(([^(]+)\)/g, '<img alt="$1" src="$2" />')
                        .replace(/\[([^\]]+)]\(([^(]+)\)/g, (<any>'$1').link('$2'))
                        .replace(/`([^`]+)`/g, '<code>$1</code>')
                        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                        .replace(/  \n/g, '<br />')
                }

                src.replace(/&gt;/g, ">").replace(/^\s+|\r|\s+$/g, "").replace(/\t/g, "    ").split(/\n\n+/).forEach(function (b: string, f: number, R: Array<string>) {
                    f = <number><any>b[0];
                    R = {
                        '*': [/\n\* /, "<ul><li>", "</li></ul>"],
                        '1': [/\n[1-9]\d*\.? /, "<ol><li>", "</li></ol>"],
                        ' ': [/\n    /, "<pre><code>", "</pre></code>", "\n"],
                        '>': [/\n> /, "<blockquote>", "</blockquote>", "\n"],
                    }[f];
                    html += R ? R[1] + ("\n" + b)
                        .split(R[0])
                        .slice(1)
                        .map(R[3] ? escape : inlineEscape)
                        .join(R[3] || "</li>\n<li>") + R[2] : <string><any>f == "#" ? "<h" + (f = b.indexOf(" ")) + ">" + inlineEscape(b.slice(f + 1)) + "</h" + f + ">" : <string><any>f == "<" ? b : "<p>" + inlineEscape(b) + "</p>";
                });
                return html;
            }
        }
        export namespace master {
            export function hasMaster(page: string): boolean {
                if (page.match(/\{\{m:master=\"(.*)\"\}\}/g) != null && page.match(/\{\{m:master=\"(.*)\"\}\}/g).length > 0) {
                    return true;
                }
                return false;
            }
            export function loadMaster(page: string): void {
                let root: string = metron.tools.getMatching(page, /\{\{m:root=\"(.*)\"\}\}/g);
                let fileName: string = metron.tools.getMatching(page, /\{\{m:master=\"(.*)\"\}\}/g);
                metron.web.load(`${root}/${fileName}`, {}, "text/html", "text", (resp: string) => {
                    metron.templates.master.merge(resp);
                },
                    (err) => {
                        document.documentElement.append(`<h1>Error: Failed to load [${root}/${fileName}].</h1><p>${err}</p>`);
                    });
            }
            export function merge(template: string): void {
                function _copyAttributes(src: Node, elemName: string) {
                    for (let i = 0; i < src.attributes.length; i++) {
                        document.documentElement.querySelector(elemName).attribute(src.attributes[i].name, src.attributes[i].value);
                    }
                }
                let placeholder: Element = document.createElement("html");
                let content = getContentRoot();
                (<HTMLElement>placeholder).innerHTML = `<metron>${template.replace("{{m:content}}", content).replace(/head/g, "mhead").replace(/body/g, "mbody").replace(/mheader/g, "header")}</metron>`;
                document.documentElement.empty();
                if (document.documentElement.hasChildNodes()) {
                    (<HTMLElement>document.querySelector("head")).innerHTML = (<HTMLElement>placeholder.querySelector("mhead")).innerHTML;
                    _copyAttributes(placeholder.querySelector("mhead"), "head");
                    (<HTMLElement>document.querySelector("body")).innerHTML = (<HTMLElement>placeholder.querySelector("mbody")).innerHTML;
                    _copyAttributes(placeholder.querySelector("mbody"), "body");
                }
                else {
                    document.documentElement.append((<HTMLElement>placeholder).innerHTML);
                }
            }
            export function getContentRoot(): string {
                if (document.documentElement.querySelector("body") != null) {
                    return (<HTMLElement>document.documentElement.querySelector("body")).innerHTML.replace(/\{\{m:root=\"(.*)\"\}\}/g, "").replace(/\{\{m:master=\"(.*)\"\}\}/g, "");
                }
                return document.documentElement.innerHTML.replace(/\{\{m:root=\"(.*)\"\}\}/g, "").replace(/\{\{m:master=\"(.*)\"\}\}/g, "");
            }
        }
    }
}
