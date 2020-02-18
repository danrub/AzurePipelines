import { compile, SafeString, escapeExpression } from "handlebars";
import { WorkItem } from "vso-node-api/interfaces/WorkItemTrackingInterfaces";
import { Change, Build } from "vso-node-api/interfaces/BuildInterfaces";
import { Release } from "vso-node-api/interfaces/ReleaseInterfaces";

type FILTER_CALLBACK = (this: any, item: any, index?: number, array?: any[]) => boolean;

function compileFilterFunction(predicate: FILTER_CALLBACK | string): FILTER_CALLBACK {

    if (typeof predicate === "string") {
        predicate = predicate.trim();

        // remove function definition if provided
        predicate = predicate.replace(/^\s+function(.|\n)*?(?=\{)/, "");

        // if lambda provided make sure result value returned from the call
        if (predicate.indexOf("return") === -1) {
            predicate = `return ${predicate}`;
        }

        return new Function("item", "index", "array", predicate) as FILTER_CALLBACK;
    }

    return predicate;
}

function addDynamicCodeHelpers(helpers: Record<string, Function>): void {

    helpers.eval = function (expr: string | undefined): string {
        return eval(expr);
    };

    helpers.safe = function (expr: string | undefined): SafeString {
        return new SafeString(expr);
    };

    helpers.escape = function (expr: string | undefined): string {
        return escapeExpression(expr);
    };

    helpers.env = function (expr: string): string {
        return process.env[expr];
    };
}

function addConditionHelpers(helpers: Record<string, Function>): void {

    helpers.eq = function (v1: any, v2: any): boolean {
        return v1 === v2;
    };

    helpers.ne = function (v1: any, v2: any): boolean {
        return v1 !== v2;
    };

    helpers.lt = function (v1: number | undefined, v2: number | undefined): boolean {
        return v1 < v2;
    };

    helpers.gt = function (v1: number | undefined, v2: number | undefined): boolean {
        return v1 > v2;
    };

    helpers.lte = function (v1: number | undefined, v2: number | undefined): boolean {
        return v1 <= v2;
    };

    helpers.gte = function (v1: number | undefined, v2: number | undefined): boolean {
        return v1 >= v2;
    };

    helpers.contains = function (v1: string | undefined, v2: string | undefined): boolean {
        if (!v1 || !v2) {
            return false;
        }
        return v1.indexOf(v2) !== -1;
    };

    helpers.startsWith = function (v1: string | undefined, v2: string | undefined): boolean {
        if (!v1 || !v2) {
            return false;
        }
        return v1.startsWith(v2);
    };

    helpers.endsWith = function (v1: string | undefined, v2: string | undefined): boolean {
        if (!v1 || !v2) {
            return false;
        }
        return v1.endsWith(v2);
    };

    helpers.match = function (v1: string | undefined, v2: RegExp | string | undefined): boolean {
        if (!v1 || !v2) {
            return false;
        }
        if (typeof v2 === "string") {
            v2 = new RegExp(v2);
        }
        return !!v1.match(v2);
    };

    helpers.some = function (v1: any[] | undefined, predicate: FILTER_CALLBACK, options: Handlebars.HelperOptions): string {
        if (!v1) {
            return options.inverse(this);
        }

        if (!(v1 instanceof Array)) {
            v1 = [v1];
        }

        predicate = compileFilterFunction(predicate);
        const hasItems = v1.some((item, index, arr) => predicate.call(item, item, index, arr));
        if (hasItems) {
            return options.fn(this);
        }

        return options.inverse(this);
    };

    helpers.and = function () {
        return Array.prototype.slice.call(arguments).every(Boolean);
    };

    helpers.or = function () {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    };
}

function addCustomHelpers(helpers: Record<string, Function>, definition: string | undefined): void {

    if (!!definition) {
        const functions = definition.match(/\s*function(.|\n)+?\}\s*((?=function)|$)/g);

        for (const helper of functions) {
            const func: Function = new Function(`return ${helper.trim()}`)();
            helpers[func.name] = func;
        }
    }
}

function addFilterHelper(helpers: Record<string, Function>) {

    helpers.filter = function (context: any[] | any | undefined, predicate: FILTER_CALLBACK, options: Handlebars.HelperOptions): string {

        predicate = compileFilterFunction(predicate);

        if (!context) {
            return options.inverse(context);
        }

        else if (context instanceof Array) {
            const filtered = context.filter((item, index, arr) => predicate.call(item, item, index, arr));
            if (filtered.length) {
                return filtered
                    .map(item => options.fn(item))
                    .join("");
            }
        }

        else if (predicate.apply(context, context)) {
            return options.fn(context, options);
        }

        return options.inverse(this);
    };

    helpers.reduce = function (context: any[] | undefined, predicate: FILTER_CALLBACK, options: Handlebars.HelperOptions): string {

        predicate = compileFilterFunction(predicate);

        if (!context) {
            return options.inverse(this);
        }

        if (!(context instanceof Array)) {
            context = [context];
        }

        predicate = compileFilterFunction(predicate);
        const reduced = context.filter((item, index, arr) => predicate.call(item, item, index, arr));
        if (reduced.length) {
            return options.fn(reduced);
        }

        return options.inverse(this);
    }
}

export function renderUsingHandleBarEngine(lines: string[], workItems: WorkItem[], commits: Change[], buildDetails: Build, releaseDetails: Release,
    compareReleaseDetails: Release, emptySetText: string, customHelpers: string | undefined): string {
    // merge back to full template representation, as handle bars has it`s own compilation logic
    const templateContent = lines.join("\n");
    const compiledTemplate = compile(templateContent);

    const helpers: Record<string, Function> = {};

    addDynamicCodeHelpers(helpers);
    addFilterHelper(helpers);
    addConditionHelpers(helpers);
    addCustomHelpers(helpers, customHelpers);

    return compiledTemplate({
        widetail: workItems,
        csdetail: commits,
        workItems,
        commits,
        buildDetails,
        releaseDetails,
        compareReleaseDetails,
        emptySetText
    }, { helpers });
}
