import { expect } from "chai";
import { renderUsingHandleBarEngine } from "../handlebars.engine";
import { WorkItem } from "vso-node-api/interfaces/WorkItemTrackingInterfaces";
import { Build, QueuePriority, BuildReason } from "vso-node-api/interfaces/BuildInterfaces";

describe("Handlebars Engine Test suite", () => {

    const buildDetails: Build = {
        id: 345,
        _links: undefined,
        buildNumber: "20200101.1",
        buildNumberRevision: 2,
        controller: undefined,
        definition: undefined,
        deleted: false,
        deletedBy: undefined,
        deletedDate: undefined,
        deletedReason: undefined,
        demands: [],
        finishTime: undefined,
        keepForever: false,
        lastChangedBy: undefined,
        lastChangedDate: undefined,
        logs: undefined,
        orchestrationPlan: undefined,
        parameters: undefined,
        plans: [],
        priority: QueuePriority.High,
        project: undefined,
        properties: undefined,
        quality: undefined,
        queue: undefined,
        queueOptions: undefined,
        queuePosition: undefined,
        queueTime: undefined,
        reason: BuildReason.PullRequest,
        repository: undefined,
        requestedBy: undefined,
        requestedFor: undefined,
        result: undefined,
        retainedByRelease: undefined,
        sourceBranch: undefined,
        sourceVersion: undefined,
        startTime: undefined,
        status: undefined,
        tags: undefined,
        triggerInfo: undefined,
        uri: "",
        url: "",
        validationResults: undefined
    };

    const workItems: WorkItem[] = [

        {
            id: 34,
            fields: {
                ["System.WorkItemType"]: "Bug",
                ["System.Title"]: "Bug number 1"
            },
            _links: [],
            relations: [],
            rev: 1,
            url: ""
        },
        {
            id: 35,
            fields: {
                ["System.WorkItemType"]: "Bug",
                ["System.Title"]: "Bug number 2"
            },
            _links: [],
            relations: [],
            rev: 1,
            url: ""
        },
        {
            id: 2,
            fields: {
                ["System.WorkItemType"]: "Backlog Item",
                ["System.Title"]: "Backlog item one"
            },
            _links: [],
            relations: [],
            rev: 1,
            url: ""
        }

    ];

    it("should render template properly", () => {

        const content = `

            *** Release {{buildDetails.buildNumber}} ***: {{ buildDetails.id }} {{eval "new Date().toISOString().replace(/T[\\d\\.:Z]+/,'')" }}

            ### Features ###
            {{#filter widetail "this.fields['System.WorkItemType'] === 'Backlog Item'" }}
            * **{{lookup fields 'System.WorkItemType'}}** {{lookup fields 'System.Title'}} (#{{id}})
            {{else}}
                {{emptySetText}}
            {{/filter}}

            ### Bugs ###
            {{#filter widetail "this.fields['System.WorkItemType'] === 'Bug'" }}
            * **{{lookup fields 'System.WorkItemType'}}** {{lookup fields 'System.Title'}} (#{{id}})
            {{else}}
                {{emptySetText}}
            {{/filter}}

            ### Tasks ###
            {{#filter widetail "this.fields['System.WorkItemType'] === 'Tasks'" }}
            * **{{lookup fields 'System.WorkItemType'}}** {{lookup fields 'System.Title'}} (#{{id}})
            {{else}}
                {{emptySetText}}
            {{/filter}}
        `;

        const lines = content.split("\n");

        const output = renderUsingHandleBarEngine(lines, workItems, [], buildDetails, undefined, undefined, "No Entries", undefined);

        expect(`

            *** Release 20200101.1 ***: 345 ${new Date().toISOString().replace(/T[\d\.:Z]+/, "")}

            ### Features ###
            * **Backlog Item** Backlog item one (#2)

            ### Bugs ###
            * **Bug** Bug number 1 (#34)
            * **Bug** Bug number 2 (#35)

            ### Tasks ###
                No Entries

        `.trim()).to.be.eq(output.trim());

    });

    it("should inject custom handlebars helper", () => {

        const template = `{{date}}`;

        const rendered = renderUsingHandleBarEngine(template.split("\n"), [], [], undefined, undefined, undefined, "", `
            function date() {
                return new Date().toISOString().replace(/T[\\d:Z\\.]+/, "");
            }
        `);

        expect(new Date().toISOString().replace(/T[\d:Z\.]+/, "")).to.be.eq(rendered);
    });

    it("should display only workItems by condtition", () => {

        const lines = `

            {{#each workItems}}
                {{#if (and (eq (lookup fields 'System.WorkItemType') "Bug") (contains (lookup fields 'System.Title') "number 2"))}}
                    {{#with fields}}
                        {{"System.Title"}}
                    {{/with}}
                {{/if}}
            {{/each}}


        `.split("\n");

        const output = renderUsingHandleBarEngine(lines, workItems, [], buildDetails, undefined, undefined, "No Entries", undefined);

        expect("Bug number 2").to.be.eq(output.trim());
    });
});