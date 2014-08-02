/*
 * Circuit
 * 
 * 
 * This class defines a Basic Circuit, which is a manager of sound creation used by Nodea Studio.
 * A Noda also manages the configuration of notes as well as their scheduling and playing that 
 * will sound on playback. Every Circuit Should Inherit from this unless it has a very good 
 * reason not to. 
 * 
 * 
 */


function Circuit(ctx, machine, marshaledCircuit, destination, circuitReplacementCallback) {
	this.ctx = ctx;	
	this.machine = machine;
	this.marshaledCircuit = marshaledCircuit;
	this.circuitReplacementCallback = circuitReplacementCallback;
	
	this.handle = this.constructor.name;
	this.id = marshaledCircuit.id;
	this.asciiCode = marshaledCircuit.ordinal;
	this.key = String.fromCharCode(this.asciiCode);
	
	this.trackline = machine.studio.tracks[this.asciiCode];
	this.swytche = machine.studio.swytches[this.asciiCode];
	
	this.container = jQuery('<spiv/>',{class: 'circuit ' + this.handle, id: 'key_'+this.asciiCode, html: this.key});
	
	this.notes = [];
	this.recordingNote = null;
	
	this.controls = {
		gain: {},
		envelope: {}
	};
				
	this.chain = new EffectsChain(this.ctx, destination, "circuits");
	this.destination = this.chain.input;
	
	this.extractSettings(marshaledCircuit.settings);
	this.extractEnvelopeAttributes(marshaledCircuit.envelopeAttributes);
	this.extractNotes(marshaledCircuit.notes);	
};


Circuit.GAIN_ATTRIBUTES = {
	volume:		{min: 0.00, max: 1.00, step: 0.05,	default: 0.80}
};

Circuit.ENVELOPE_ATTRIBUTES = {	
	attack:		{min: 0.00, max: 2.00, step: 0.05,	default: 0.05},
	decay:		{min: 0.00, max: 2.00, step: 0.05,	default: 0.05},
	sustain:	{min: 0.00, max: 1.00, step: 0.05,	default: 0.40},
	release:	{min: 0.00, max: 2.00, step: 0.05,	default: 0.15}
};


Circuit.prototype.extractChain = function(settings){
	if( settings.chain ){
		this.chain.load(settings.chain);
	} else {
		this.chain.load([]);
	}
};


Circuit.prototype.extractSettings = function(settings){
	if( settings ){
		this.extractChain(settings);
	}
};

Circuit.prototype.extractEnvelopeAttributes = function(envelopeAttributes){
	if( envelopeAttributes === undefined || envelopeAttributes === null ){
		this.envelopeAttributes = {};
		for( key in Circuit.ENVELOPE_ATTRIBUTES){
			this.envelopeAttributes[key] = Circuit.ENVELOPE_ATTRIBUTES[key].default;
		}
		this.envelopeAttributes.volume = Circuit.GAIN_ATTRIBUTES.volume.default;
	} else {
		this.envelopeAttributes = envelopeAttributes;
	}
};


Circuit.prototype.extractNotes = function(notes){
	notes.forEach( function(persistedNote){ 
		var studioNote = new Note(persistedNote);
		studioNote.envelope = this.allocateEnvelope();
		studioNote.circuit = this;
		studioNote.createContainer().prependTo(this.trackline);
		this.addNote(studioNote);
		return studioNote;
	}, this);
};



// Drawers and Circuit Bindings

Circuit.prototype.generateDrawer = function(){	
	var detailsElement = $("#circuit_controls");
	detailsElement.empty();
	
	var circuitSection = DrawerUtils.createSection(detailsElement, "Circuit");
	DrawerUtils.createSelector(Circuit.circuitsManifest, this.handle, this.replaceSelf.bind(this), circuitSection.head).addClass("heading_select dextra");
	if( this.constructor !== Circuit ){
		this.generateCircuitDivision(DrawerUtils.createDivision(circuitSection.body, this.handle));
	}
	this.generateEnvelopeDivision(DrawerUtils.createDivision(circuitSection.body, "Amp Envelope"));
	
	this.chain.render( DrawerUtils.createSection(detailsElement, "Effects").body );
	
	DrawerUtils.activateDrawerToggles($("#circuit_drawer"));
	
	return circuitSection;
};

Circuit.prototype.replaceSelf = function(newHandle){
	this.circuitReplacementCallback(this, newHandle);
};



Circuit.prototype.generateCircuitDivision = function(divisionBody, callback) {
	var self = this;
	$.get("circuits/"+this.handle+"/"+this.handle+".html",null,function(data){
		self.circuitBody = $(data).appendTo(divisionBody);
		self.circuitBody.
			keydown(    function(ev){ ev.stopPropagation(); }).
			keyup(      function(ev){ ev.stopPropagation(); });
	
		self.generateCircuitBody.call(self,self.circuitBody);
		if(callback){
			callback();
		}
	});
};

Circuit.prototype.generateEnvelopeDivision = function(divisionBody){
	for(var key in Circuit.GAIN_ATTRIBUTES){
		var attributes = Circuit.GAIN_ATTRIBUTES[key];
		var changer = function(key, value){
			this.envelopeAttributes[key] = value;
			studio.invalidateSavedStatus();
		}.bind(this);
		this.controls.gain[key] = DrawerUtils.createSlider(key, attributes, this.envelopeAttributes[key], changer, divisionBody);
	}
	
	for(var key in Circuit.ENVELOPE_ATTRIBUTES){
		var attributes = Circuit.ENVELOPE_ATTRIBUTES[key];
		var changer = function(key, value){
			this.envelopeAttributes[key] = value;
			studio.invalidateSavedStatus();
		}.bind(this);
		this.controls.envelope[key] = DrawerUtils.createSlider(key, attributes, this.envelopeAttributes[key], changer, divisionBody);
	}
};






Circuit.prototype.generateCircuitBody = function(circuitBody){	
};

Circuit.prototype.isDisplaying = function(){
	return this.circuitBody && this.circuitBody.closest("html").length > 0;
};



Circuit.prototype.allocateEnvelope = function(){
	var envelope = this.ctx.createGain();
	envelope.gain.value = 0;
	envelope.connect(this.destination);
	return envelope;
};

// Note Manipulation

Circuit.prototype.addNoteNoUndo = function(note){
	if( note !== null ){
		this.notes.push(note);
		if( !note.container ){ 
			note.createContainer(); 
		}
	}
};

Circuit.prototype.addNote = function(note){
	this.addNoteNoUndo(note);
	
	var self = this;
	studio.pushUndoRedo(
		function(){self.deleteNoteNoUndo(note);}, 
		function(){self.addNoteNoUndo(note);}
	);
};




Circuit.prototype.deleteNoteNoUndo = function(note){
	note.envelope.disconnect(0);
	var idx = this.notes.indexOf(note);
	if( idx !== -1 ){
		this.notes.splice(idx, 1);
		if(note.container){ 
			note.container.remove();
			note.container = null;
		}
	}
};

Circuit.prototype.deleteNote = function(note){
	this.deleteNoteNoUndo(note);
	
	var self = this;
	studio.pushUndoRedo(
		function(){self.addNoteNoUndo(note);}, 
		function(){self.deleteNoteNoUndo(note);}
	);
};






// playback

Circuit.prototype.play = function(pixelsPerSecond, startingAt){
    var startTime = this.ctx.startTime;
    this.notes.forEach( function(note){
        if( note.start >= startingAt ){
			var startWhen = ((note.start-startingAt)/pixelsPerSecond)+startTime;
			var endWhen = ((note.finish-startingAt)/pixelsPerSecond)+startTime;
            this.scheduleCircuitStart(startWhen, note);
			this.scheduleCircuitStop(endWhen, note);
        }
    }, this);
};


Circuit.prototype.scheduleCircuitStart = function(startWhen, note){
	var gain = note.envelope.gain;
	var attributes = this.envelopeAttributes;
	gain.setValueAtTime(gain.value, startWhen);
	gain.linearRampToValueAtTime(attributes.volume, startWhen + attributes.attack);
	gain.linearRampToValueAtTime(attributes.sustain*attributes.volume, startWhen + attributes.attack + attributes.decay);
	return this.chain.start(startWhen);
};

Circuit.prototype.scheduleCircuitStop = function(endWhen, note){
	var release = this.envelopeAttributes.release;
	if( endWhen <= this.ctx.currentTime ){
		// If this line is on, realtime playback is great, but Recorded playback suffers.
		note.envelope.gain.setValueAtTime(note.envelope.gain.value, endWhen); 
	}
	note.envelope.gain.linearRampToValueAtTime(0.0, endWhen + release);
	return release + this.chain.stop(endWhen);
};


Circuit.prototype.pause = function(){
    this.lightOff('active');
};



// recording

Circuit.prototype.on = function(location) {
	if(location){
		this.recordingNote = new Note({start: location, circuit: this});
		this.recordingNote.envelope = this.allocateEnvelope();
		this.recordingNote.createContainer();
		this.lightOn('recording');
	} else {
		this.lightOn('active');
	}
	
	navigator.vibrate(10);
};

Circuit.prototype.off = function(location) {
	if(location && this.recordingNote !== null){
		var note = this.recordingNote;
		if( note.start > location ){
			note.container.remove();
		} else {
			if( note.start === location ){
				location++;
			}
			note.newFinishNoUndo(location);
			this.addNote(note);
		}
		this.recordingNote = null;
		this.lightOff('recording');
	} else {
		this.lightOff('active');
	}
};




Circuit.prototype.frame = function( location ){
	var note = this.recordingNote;
	if( note !== null && note.container ){ 
		note.container.css('height', location-note.start+'px'); 
	}
};








// lighting

Circuit.prototype.lightOn = function(lightType){
    $(this.container).addClass(lightType);
    $(this.swytche).addClass(lightType);
	return this;
};
Circuit.prototype.lightOff = function(lightType){
    $(this.container).removeClass(lightType);
    $(this.swytche).removeClass(lightType);
	return this;
};

Circuit.prototype.lightsOut = function(){
    $(this.container).removeClass('active').removeClass('recording').removeClass('selected');
    $(this.swytche).removeClass('active').removeClass('recording').removeClass('selected');
	return this;
};







// saving

Circuit.prototype.marshal = function(){
	return {
		handle: this.handle,
		ordinal: this.asciiCode,
		notes: this.notes.map( function(note){return {start: note.start, finish: note.finish};} ),
		envelopeAttributes: this.envelopeAttributes,
		settings: this.marshalSettings()
	};
};

Circuit.prototype.marshalSettings = function(){
	return {
		chain: this.chain.marshal()
	};
};


Circuit.circuitsManifest = [
	"",
	"Sampler",
	"Oscillator"
];