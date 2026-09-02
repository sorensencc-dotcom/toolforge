interface BuildOptions {
    action: string;
    registry: string;
    workdir: string;
    dryRun: boolean;
    verbose: boolean;
}
interface ImageResult {
    name: string;
    status: string;
    digest?: string;
    error?: string;
}
export declare function main(args?: Partial<BuildOptions>): Promise<{
    status: string;
    message: string;
    data: {
        action: "all" | "build" | "tag" | "push" | "verify" | "import";
        images: ImageResult[];
        registry: string;
        duration_ms: number;
    };
} | {
    status: string;
    message: any;
    data: null;
}>;
export {};
//# sourceMappingURL=index.d.ts.map