function Machine( ctx, tabDefinition, marshaledMachine, machineReplacementCallback ){
	this.ctx = ctx;
	this.ascii = tabDefinition.ascii;
	this.color = tabDefinition.color;
	this.handle = marshaledMachine.handle;
	this.machineReplacementCallback = machineReplacementCallback;
	
	if( !marshaledMachine.circuits ){
		marshaledMachine.circuits = {};
	}
	
	this.circuits = {};
	this.mousedCircuits = {};
	
	var self = this;
	this.tab = $("<spiv/>",{class:"machine", html:String.fromCharCode(this.ascii)}).
		on("click", function(ev){
			self.studio.selectMachine(self.ascii);
		});
		
	this.circuitsContainer = $("<div/>",{class:"circuits"}).hide();
	
	this.chain = new EffectsChain(this.ctx, this.ctx.destination, "machines");
	this.destination = this.chain.input;
	
	this.extractSettings(marshaledMachine.settings);
	this.extractCircuits(marshaledMachine.circuits);
	
	// Touchpad maybe later
	//$('<div/>',{class: 'touchpad'}).appendTo(this.keyContainer);
};




Machine.prototype.extractChain = function(settings){
	if( settings.chain ){
		this.chain.load(settings.chain);
	}
};


Machine.prototype.extractSettings = function(settings){
	if( settings ){
		this.extractChain(settings);
	}
};


Machine.prototype.extractCircuits = function(marshaledCircuits){
	var nodeRowClass = "sinistra";
	var keyRow;
	NodeaStudio.instance.keyset.domOrder.forEach(function(keySetKey, idx){
		var rowKeyIndex = idx%15;
		if( rowKeyIndex === 0 ){
			keyRow = $('<div/>',{class: 'circuitRow '+nodeRowClass}).appendTo(this.circuitsContainer);
		}
		
		var marshaledCircuit = marshaledCircuits[keySetKey];
		if( !marshaledCircuit ){
			marshaledCircuit = this.defaultCircuit(keySetKey);
		}
		marshaledCircuit.tempContainer = $('<div/>',{class: 'circuit'}).appendTo(keyRow);
		if(marshaledCircuit.handle === 'Function'){
			marshaledCircuit.handle = "Circuit";
		}

		this.initializeCircuit(marshaledCircuit, function(newCircuit, marshaledCircuit){
			marshaledCircuit.tempContainer.replaceWith(newCircuit.container);
			delete marshaledCircuit.tempContainer;
			if(this.selectedCircuit === newCircuit.asciiCode){
				this.swytcheSelected(newCircuit.asciiCode);
			}
		}.bind(this));
		nodeRowClass = nodeRowClass === 'sinistra' ? 'dextra' : 'sinistra';
	}, this);
};

Machine.prototype.defaultCircuit = function(ordinal){
	return { id: null, ordinal: ordinal, handle: "Circuit", notes: [] };
};


Machine.prototype.initializeCircuit = function(marshaledCircuit, callback){
	if(!callback){
		callback = function(newCircuit){};
	}
	
	var self = this;

	var newCircuit = self.eagerInitializeCircuit(marshaledCircuit);
	callback.call(self, newCircuit, marshaledCircuit);
	
};


Machine.prototype.eagerInitializeCircuit = function(marshalledCircuit){
	var handle = marshalledCircuit.handle;
	
	var circuitConstructor = window[handle];
	if(!circuitConstructor){
		console.error("Could not find Constructor for "+handle);
		return;
	}
	
	NodeaStudio.instance.circuitStylesheet.innerHTML += ".node."+handle+
		"{ background-image: url('circuits/"+handle+"/"+handle+".png'); background-size: cover; }";
	
	
	var self = this;
	var circuit = new circuitConstructor(this.ctx, this, marshalledCircuit, this.destination, function(oldCircuit, newHandle){
		 self.replaceCircuit(oldCircuit, newHandle);
	});
	
	this.circuits[marshalledCircuit.ordinal] = circuit;
		
	var self = this;
	circuit.container.
			on("mousedown",function(ev){ 
				self.circuitOn(circuit);
				self.mousedCircuits[circuit.asciiCode] = circuit;
				ev.stopPropagation(); }).
			on("mouseup",function(ev){ 
				self.circuitOff(circuit); 
				delete self.mousedCircuits[circuit.asciiCode];
			}).
			on("click", function(ev){ ev.stopPropagation(); });
		
	return circuit;
};


Machine.prototype.replaceCircuit = function( oldCircuit, newHandle ){
	var marshaledCircuit = oldCircuit.marshal();
	marshaledCircuit.handle = newHandle;
	
	var self = this;
	this.initializeCircuit( marshaledCircuit, function(newCircuit, marshaledCircuit){
		newCircuit.swytche.trigger("click");
		oldCircuit.container.replaceWith(newCircuit.container);
		NodeaStudio.invalidateSavedStatus();
	});
};


Machine.prototype.mouseup = function(){
	for( asciiCode in this.mousedCircuits ){
		this.noteOff(this.mousedCircuits[asciiCode]);
	}
	this.mousedCircuits = {};
};





// Playback

Machine.prototype.circuitOn = function( circuit ){	
	if( NodeaStudio.instance.recording ){
		circuit.on(NodeaStudio.instance.pixelFor(Date.now()));
		NodeaStudio.instance.recordingNodas.push(circuit);
	} else {
		circuit.on();
	}
	
	circuit.keydown = true;	
};

Machine.prototype.circuitOnAscii = function( ordinal ){
	var circuit = this.circuits[ordinal];
	if( !circuit || circuit.keydown || circuit.mousedown ){
		return;
	}
	this.circuitOn(circuit);
};


Machine.prototype.circuitOff = function( circuit ){
	if( NodeaStudio.instance.recording ){
		circuit.off(NodeaStudio.instance.location);
		this.invalidateSavedStatus();
		
		var recordingNodas = NodeaStudio.instance.recordingNodas;
		var rn_indx = recordingNodas.indexOf(circuit);
		if( rn_indx > -1 ){
			recordingNodas.splice(rn_indx, 1);
		}
	} else {
		circuit.off();
	}
	circuit.keydown = false;
};

Machine.prototype.circuitOffAscii = function( ordinal ){
	var circuit = this.circuits[ordinal];
	if(!circuit){
		return;
	}
	this.circuitOff(circuit);
};


Machine.prototype.off = function(){
	for( var ordinal in this.circuits ){
		this.circuitOffAscii(ordinal);
	};
};

Machine.prototype.pause = function(){
	for( var ordinal in this.circuits ){
		this.circuitPauseAscii(ordinal);
	};
};

Machine.prototype.circuitPauseAscii = function(ordinal){
	var circuit = this.circuits[ordinal];
	if(!circuit){
		return;
	}
	this.circuitPause(circuit);
};

Machine.prototype.circuitPause = function(circuit){
	this.circuitOff(circuit);
	circuit.pause();
};





// Drawers and Circuit Bindings

Machine.prototype.generateDrawer = function(){	
	var machineElement = $("#machine_controls");
	machineElement.empty();
	var machineSection = DrawerUtils.createSection(machineElement, "");
	DrawerUtils.createSelector(Machine.machinesManifest, this.handle, this.replaceSelf.bind(this), machineSection.head).addClass("heading_select").addClass("sinistra");
	if( this.constructor !== Machine ){
		this.generateMachineDivision(machineSection.body);
	}
	DrawerUtils.activateDrawerToggles(machineElement);
	
	var effectsElement = $("#effects_controls");
	effectsElement.empty();
	this.chain.render( DrawerUtils.createSection(effectsElement, "Effects").body, "machines" );
	
	return machineSection;
};

Machine.prototype.replaceSelf = function(newHandle){
	this.machineReplacementCallback(this, newHandle);
};


Machine.prototype.generateMachineDivision = function(sectionBody) {
	machineDivision = DrawerUtils.createDivision(sectionBody, null);
	this.machineBody = $(this.constructor.templateHTML).appendTo(machineDivision.body);
	this.machineBody.
		on("keydown",    function(ev){ ev.stopPropagation(); }).
		on("keyup",      function(ev){ ev.stopPropagation(); });
	this.generateMachineBody.call(this, this.machineBody);
};

Machine.prototype.generateMachineBody = function(machineBody){	
};

Machine.prototype.isDisplaying = function(){
	return this.machineBody && this.machineBody.closest("html").length > 0;
};









Machine.prototype.select = function(){
	this.generateDrawer();
	
	$(".machine").removeAttr("style");
	$("#circuits .circuits").hide();
	
	this.tab.attr("style", "background-color: "+this.color+"; color: black;");
	this.circuitsContainer.show();
	
	if(!this.selectedCircuit){
		this.selectedCircuit = NodeaStudio.defaultCircuitCode;
	}
	//this.swytcheSelected(this.selectedCircuit);
};

/*
Machine.prototype.swytcheSelected = function(ordinal){
	this.selectedCircuit = ordinal;
	ordinal = ordinal.toString();
	for( ascii in this.circuits){
		var circuit = this.circuits[ascii];
		if( ascii === ordinal ){
			circuit.lightOn('selected');
			circuit.generateDrawer();
		} else {
			circuit.lightOff('selected');
		}
	}
};
*/




Machine.prototype.invalidateSavedStatus = function(){
	NodeaStudio.invalidateSavedStatus();
};

Machine.prototype.marshal = function(){
	var ret= {
		ascii: this.ascii,
		handle: this.constructor.name,
		circuits: this.marshalCircuits(),
		settings: this.marshalSettings()
	};
	
	return ret;
};

Machine.prototype.marshalCircuits = function(){
	var ret = {};
	for( var key in this.circuits ){
		var circuit = this.circuits[key];
		if(circuit.handle !== "Circuit"){
			ret[key] = circuit.marshal();
		}
	}
	return ret;
};

Machine.prototype.marshalSettings = function(){
	return {
		chain: this.chain.marshal()
	};
};





// === Constants ===

Machine.ASCII_KEYS = [
	'1','2','3','4','5','6','7','8','9','0',
	'q','w','e','r','t','y','u','i','o','p',
	'a','s','d','f','g','h','j','k','l',';',
	'z','x','c','v','b','n','m',',','.','/'
];


Machine.keyCodeToAsciiMap = {
	 // uppercase latin
	65:  97,	66:  98,	67:  99,	68:  100,	69:  101,	
	70:  102,	71:  103,	72:  104,	73:  105,	74:  106,	
	75:  107,	76:  108,	77:  109,	78:  110,	79:  111,	
	80:  112,	81:  113,	82:  114,	83:  115,	84:  116,	
	85:  117,	86:  118,	87:  119,	88:  120,	89:  121,	
	90:  122,	
	
	// punctuation
	186: 59,	188: 44,	190: 46,	191: 47
};


Machine.machinesManifest = [
	"Machine",
	"Synthesizer",
	"MultiSampler",
	"DrumMachine"
];
