import Context from "../../../src/context";

class MyContext extends Context {
	constructor(opts: any) {
		super(opts);
		this.myProp = "a";
	}

	myProp: string;
}

export = MyContext;
