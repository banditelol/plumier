import {
    analyzeRoutes,
    Application,
    Configuration,
    DependencyResolver,
    Facility,
    generateRoutes,
    hasKeyOf,
    KoaMiddleware,
    Middleware,
    MiddlewareUtil,
    PlumierApplication,
    PlumierConfiguration,
    printAnalysis,
    RouteInfo,
    router,
} from "@plumier/core"
import Koa from "koa"
import { dirname } from "path"


class DefaultDependencyResolver implements DependencyResolver {
    resolve(type: new (...args: any[]) => any) {
        return new type()
    }
}

const DefaultConfiguration: Configuration = {
    mode: "debug",
    controller: "./controller",
    dependencyResolver: new DefaultDependencyResolver()
}

export class Plumier implements PlumierApplication {
    readonly config: Readonly<PlumierConfiguration>;
    readonly koa: Koa
    private globalMiddleware: Middleware[] = []

    constructor() {
        this.koa = new Koa()
        this.config = { ...DefaultConfiguration, middleware: [], facilities: [] }
    }

    use(option: KoaMiddleware): Application
    use(option: Middleware): Application
    use(option: KoaMiddleware | Middleware): Application {
        if (typeof option === "function") {
            this.globalMiddleware.push(MiddlewareUtil.fromKoa(option))
        }
        else {
            this.globalMiddleware.push(option)
        }
        return this
    }

    set(facility: Facility): Application
    set(config: Partial<Configuration>): Application
    set(config: Partial<Configuration> | Facility): Application {
        if (hasKeyOf<Facility>(config, "setup")) {
            config.setup(this)
            this.config.facilities.push(config)
        }
        else
            Object.assign(this.config, config)
        return this;
    }

    async initialize(): Promise<Koa> {
        try {
            if (process.env["NODE_ENV"] === "production")
                Object.assign(this.config, { mode: "production" })
            //get file location of script who initialized the application to calculate the controller path
            //module.parent.parent.filename -> because Plumier app also exported in plumier/src/index.ts
            let routes: RouteInfo[] = generateRoutes(dirname(module.parent!.parent!.filename), this.config.controller)
            for (const facility of this.config.facilities) {
                await facility.initialize(this, routes)
            }
            if (this.config.mode === "debug") printAnalysis(analyzeRoutes(routes))
            this.koa.use(router(routes, this.globalMiddleware))
            return this.koa
        }
        catch (e) {
            throw e
        }
    }
}
