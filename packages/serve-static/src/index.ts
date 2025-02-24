import { ActionResult, DefaultFacility, Invocation, Middleware, PlumierApplication, response } from "@plumier/core"
import { Context } from "koa"
import send from "koa-send"
import { extname } from "path"
import { string } from 'joi';


declare module "@plumier/core" {
    namespace response {
        function file (path: string, opt?: ServeStaticOptions) :ActionResult
    }

    export interface Configuration {
        sendFile?: (path:string, opt?:ServeStaticOptions) => Promise<string>
    }
}

export interface ServeStaticOptions {
    /** 
     * Root directory of static assets 
     **/
    root: string

    /** 
     * Browser cache max-age in milliseconds. (defaults to 0) 
     **/
    maxAge?: number

    /** 
     * Tell the browser the resource is immutable and can be cached indefinitely. (defaults to false) 
     **/
    immutable?: boolean;

    /** 
     * Try to serve the gzipped version of a file automatically when gzip is supported by a client and if the requested file with .gz extension exists. (defaults to true). 
     **/
    gzip?: boolean;

    /** 
     * Try to serve the brotli version of a file automatically when brotli is supported by a client and if the requested file with .br extension exists. (defaults to true). 
     **/
    brotli?: boolean;
}

export class FileActionResult extends ActionResult {
    constructor(path: string, private opt?: ServeStaticOptions) {
        super(path)
        if (!this.opt)
            this.opt = { root: "/" }
    }

    async execute(ctx: Context) {
        await super.execute(ctx)
        ctx.type = extname(this.body)
        const sendFile = ctx.config.sendFile || ((path:string, opt?:ServeStaticOptions) => send(ctx, path, opt))
        await sendFile(this.body, this.opt)
    }
}

export class ServeStaticMiddleware implements Middleware {
    constructor(public option: ServeStaticOptions) { }

    async execute(invocation: Readonly<Invocation>): Promise<ActionResult> {
        //no route = no controller = possibly static file request
        if (!invocation.context.route) {
            //execute action result directly here, so if file not found it will possible to chain with next middleware
            try {
                const result = new FileActionResult(invocation.context.path, this.option)
                await result.execute(invocation.context)
                return ActionResult.fromContext(invocation.context)
            }
            catch (e) {
                if (e.status && e.status === 404)
                    return invocation.proceed()
                else
                    throw e
            }
        }
        else
            return invocation.proceed()
    }
}

export class ServeStaticFacility extends DefaultFacility {
    constructor(public option: ServeStaticOptions) { super() }

    setup(app: Readonly<PlumierApplication>) {
        app.use(new ServeStaticMiddleware(this.option))
    }
}


response.file = (path: string, opt?: ServeStaticOptions) => new FileActionResult(path, opt)