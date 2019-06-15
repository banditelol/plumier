import { fixture } from '../../../test/helper';
import supertest = require('supertest');

export class HomeController {
    index() {
        return { message: "Hello world!" }
    }
}

describe("Single File", () => {
    it("Should able to host controller in the same file with bootstrap application", async () => {
        const koa = await fixture(__filename).initialize()
        await supertest(koa.callback())
            .get("/home/index")
            .expect(200)
    })
})