import type { ServiceSchema, ServiceSettingSchema } from "../src/service";

interface SilentSettings extends ServiceSettingSchema {
	silent: boolean;
}

const SilentSchema: ServiceSchema<SilentSettings> = {
	name: "silent",
	settings: {
		silent: true
	},
	actions: {
		topsecret: {
			protected: true,
			handler() {
				return "Only accessible locally!";
			}
		}
	}
};

export default SilentSchema;
