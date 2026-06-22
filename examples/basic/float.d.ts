export default function grammar(): void;
export default class grammar {
    grammarObject: string;
    rules: {
        name: string;
        lower: string;
        index: number;
    }[];
    udts: any[];
    toString: () => string;
}
