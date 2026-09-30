import Service from "../../../src/service";

class MyService extends Service {
	constructor(broker: any, schema: any) {
		super(broker, schema);
		this.myProp = 123;
	}

	myProp: number;
}

export = MyService;
