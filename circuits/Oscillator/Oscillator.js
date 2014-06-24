function Oscillator(ctx, machine, marshaledCircuit, destination, circuitReplacementCallback) {
	/* The Super Constructor will Instantiate things 
	 * that every circuit needs, including each 
	 * visual component and the event ties for each one.
	 **/
	Circuit.call(this, ctx, machine, marshaledCircuit, destination, circuitReplacementCallback);
	
	/* Build out any further initialization you need 
	 * to do here. 
	 */
};

Oscillator.extends(Circuit);


Oscillator.prototype.extractSettings = function(settings){
	Circuit.prototype.extractSettings.call(this, settings);
	if(settings){
		if(settings.pitch){
			this.pitch = new Pitch(settings.pitch.color, settings.pitch.octave);
		}
		
		this.oscillatorAttributes = [];
		if(settings.oscillatorAttributes){
			settings.oscillatorAttributes.forEach(function(oscSettings){
				this.oscillatorAttributes.push(this.extractOscillatorSettings(oscSettings));
			}, this);
		}
		if(this.oscillatorAttributes.length === 0){
			this.oscillatorAttributes.push(Oscillator.DEFAULT_OSCILLATOR);
		}
	}
	
	if(!this.pitch){
		this.pitch = Oscillator.DEFAULT_PITCH;
	}
};

Oscillator.DEFAULT_PITCH = new Pitch("A",4);

Oscillator.DEFAULT_OSCILLATOR = {
	signalType: "sine",
	offset: {semitones: 0, cents: 0}
};

Oscillator.SIGNAL_TYPES = [
	"sine","square","sawtooth"
];


Oscillator.prototype.extractOscillatorSettings = function(settings){
	var osc = {};
	if( settings){
		/* Any necessary settings that you add in the marshalSettings function 
		 * will be in settings
		 */
		if(settings.offset){
			osc.offset = settings.offset;
		}
		if(settings.type){
			osc.signalType = settings.signalType;
		}
	}
	
	if(!osc.offset){
		osc.offset = {semitones: 0, cents: 0};
	}
	if(!osc.signalType){
		osc.signalType = "sine";
	}
	return osc;
};


Oscillator.prototype.addOscillator = function(){
	this.oscillatorAttributes.push(Oscillator.DEFAULT_OSCILLATOR);
	this.generateDrawer();
};

Oscillator.prototype.removeOscillator = function(oscillator){
	var idx = this.oscillatorAttributes.indexOf(oscillator);
	if(idx > -1){
		this.oscillatorAttributes.splice(idx,1);
	}
	this.generateDrawer();
};


Oscillator.prototype.repitch = function(pitch){
	this.pitch = pitch;
	if( this.isDisplaying() ){
		this.circuitBody.find("#Oscillator-Color").val(pitch.color).change();
		this.circuitBody.find("#Oscillator-Octave").val(pitch.octave).change();
	}
	this.resetOscillators();
};




/*
 * --- Drawer Layout ---
 * 
 * @param circuitBody is the main element of the drawer.
 * circuitBody has already been filled out with the contents of {handle}.html
 * Use this function to fill in info, turn knobs, attach events on {handle}.html
 */

Oscillator.prototype.generateCircuitBody = function(circuitBody){
	var self = this;
	var colorSelector = $(circuitBody).find("#Oscillator-Color");
	Pitch.pitchKeySelector(colorSelector);
	colorSelector.val(this.pitch.color).
		change(	function(ev){ 
			self.color = this.value;
			studio.invalidateSavedStatus(); 
		});
	
	$(circuitBody).find("#Oscillator-Octave").
		val(this.pitch.octave).
		change(	function(ev){ 
			self.octave = this.value;
			studio.invalidateSavedStatus(); 
		});
		
	$(circuitBody).find("#Oscillator-Add").
		click(	function(ev){ 
			self.addOscillator();
			studio.invalidateSavedStatus(); 
		});
		
	var oscillatorList = $(circuitBody).find("#Oscillator-List");
	this.oscillatorAttributes.forEach( function(oscillator, idx){
		var oscillatorDiv = $("<div/>",{id:"oscillator_"+idx, class:"listed"}).appendTo(oscillatorList);
		
		$("<div/>",{class:"fieldLabel",text:"Signal "+(idx+1)}).appendTo(oscillatorDiv);
		
		var signalDiv = $("<spiv></spiv>").appendTo(oscillatorDiv);
		var signalSelector = $("<select/>").appendTo(signalDiv);
		Oscillator.SIGNAL_TYPES.forEach(function(signalType){
			$("<option/>",{text: signalType, value: signalType, selected: (signalType===oscillator.signalType)}).appendTo(signalSelector);
		});
		signalSelector.change( function(ev){ 
			oscillator.signalType = this.value;
			self.resetOscillators();
			studio.invalidateSavedStatus(); 
		});
		$("<div class='thicket'>SIGNAL TYPE</div>").appendTo(signalDiv);
		
		var semitoneDiv = $("<spiv></spiv>").appendTo(oscillatorDiv);
		$("<input/>",{type:"number",value:oscillator.offset.semitones, class:"short"}).appendTo(semitoneDiv).change(function(ev){
			oscillator.offset.semitones = parseInt(this.value);
		});
		$("<div class='thicket'>SEMITONES</div>").appendTo(semitoneDiv);
		
		var centsDiv = $("<spiv></spiv>").appendTo(oscillatorDiv);
		$("<input/>",{type:"number",value:oscillator.offset.cents, class:"short"}).appendTo(centsDiv).change(function(ev){
			oscillator.offset.cents = parseInt(this.value);
		});
		$("<div class='thicket'>CENTS</div>").appendTo(centsDiv);
		
		$("<button></button>",{text:"remove"}).appendTo(oscillatorDiv).click(function(ev){
			self.removeOscillator(oscillator);
		});
	});
};





/*
 * --- Note Creation ---
 * 
 * These functions are here if you want to override them. In many cases, 
 * you'll want to do something extra to the note object. If your circuit
 * won't need these, then feel free to delete them.
 */
Oscillator.prototype.addNote = function(note){
	Circuit.prototype.addNote.call(this, note);
	note.oscillators = this.allocateOscillators();
	note.oscillators.forEach(function(oscillator){
		oscillator.connect(note.envelope);
	});
};
Oscillator.prototype.deleteNote = function(note){	
	note.oscillators.forEach(function(oscillator){
		this.deallocateOscillator(oscillator);
	}, this);
	Circuit.prototype.deleteNote.call(this, note);
};

Oscillator.prototype.allocateOscillators = function(){
	var oscillators = [];
	this.oscillatorAttributes.forEach(function(oscillator){
		var oscNode = this.ctx.createOscillator();
		oscNode.type = oscillator.signalType;
		oscNode.frequency.value = Pitch.addCents(this.pitch.frequency, (oscillator.offset.semitones*100)+oscillator.offset.cents);
		oscillators.push(oscNode);
	}, this);
	return oscillators;
};

Oscillator.prototype.deallocateOscillator = function(osc){
	if(osc){ osc.disconnect(0); }
};


/*
 * --- Playback ---
 *		
 * These functions alert your circuit to when the User has requested
 * the song to Play or Pause. 
 * @param sliversPerSecond is an integer that represents the Studio's
 *			note resolution. Combine this with a variable in units of 
 *			slivers or seconds to translate between the two units.
 * @param startAt is an integer that represents the sliver that the
 *			playback should begin at. Schedule your notes based
 *			on this parameter.
 */
Oscillator.prototype.scheduleCircuitStart = function(startWhen, note){
	var delayTime = Circuit.prototype.scheduleCircuitStart.call(this, startWhen, note);
	note.oscillators.forEach(function(oscillator){
		oscillator.start(startWhen + delayTime);
	});
	return delayTime;
};

Oscillator.prototype.scheduleCircuitStop = function(endWhen, note){
	var delayTime = Circuit.prototype.scheduleCircuitStop.call(this, endWhen, note);
	note.oscillators.forEach(function(oscillator){
		oscillator.stop(endWhen + delayTime);
	});
	return delayTime;
};

Oscillator.prototype.pause = function(){
	Circuit.prototype.pause.call(this);
	this.resetOscillators();
};



Oscillator.prototype.resetOscillators = function(){
	this.notes.forEach(function(note){ 
		note.oscillators.forEach(function(osc){
			this.deallocateOscillator(osc);
		}, this);
		note.oscillators = this.allocateOscillators();
		note.oscillators.forEach(function(oscillator){
			oscillator.connect(note.envelope);
		});
	}, this);
};










/*
 * --- User Input ---
 * 
 * The following functions (on,off) notify your Circuit
 * when the user has pressed the key bound to your circuit.
 * Use these functions to audibly play your note. All else 
 * will be handled for you 
 */

Oscillator.prototype.on = function(location) {
	Circuit.prototype.on.call(this, location);
	this.oscillatorNodes = this.allocateOscillators();
	this.envelope = this.allocateEnvelope();
	this.oscillatorNodes.forEach(function(oscNode){
		oscNode.connect(this.envelope);
	}, this);
	this.scheduleCircuitStart(this.ctx.currentTime, {oscillators: this.oscillatorNodes, envelope: this.envelope});
};


Oscillator.prototype.off = function(location) {
	Circuit.prototype.off.call(this, location);
	if( this.oscillatorNodes && this.envelope ){
		var targetOscs = this.oscillatorNodes;
		var targetEnv = this.envelope;
		delayTime = this.scheduleCircuitStop(this.ctx.currentTime, {oscillators: targetOscs, envelope: targetEnv});
		var self = this;
		window.setTimeout(function(){
			targetOscs.forEach(function(osc){
				self.deallocateOscillator(osc);
			});
		}, delayTime*1000);
	}
};







/* --- Marshaling ---
 * 
 * This function is for saving any settings you have on your circuit 
 * that you want passed to its constructor whenever this instance of 
 * your Circuit is created. This will appear in the constructor as 
 * persistedNoda.settings
 */

Oscillator.prototype.marshalSettings = function(){
	ret = Circuit.prototype.marshalSettings.call(this);
	if( this.pitch ){
		ret.pitch = this.pitch.marshal();
	}
	if( this.oscillatorAttributes ){
		ret.oscillatorAttributes = [];
		this.oscillatorAttributes.forEach(function(osc){
			ret.oscillatorAttributes.push({
				signalType: osc.signalType,
				offset: osc.offset
			});
		});
	}
	return ret;
};
