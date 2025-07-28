export namespace main {
	
	export class LanguageSettings {
	    currentLanguage: string;
	
	    static createFrom(source: any = {}) {
	        return new LanguageSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentLanguage = source["currentLanguage"];
	    }
	}
	export class ProbeResult {
	    success: boolean;
	    error?: string;
	    time: string;
	    length: number;
	    hexGo: string;
	    hexSlash: string;
	    decimal: number[];
	    string: string;
	
	    static createFrom(source: any = {}) {
	        return new ProbeResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	        this.time = source["time"];
	        this.length = source["length"];
	        this.hexGo = source["hexGo"];
	        this.hexSlash = source["hexSlash"];
	        this.decimal = source["decimal"];
	        this.string = source["string"];
	    }
	}

}

