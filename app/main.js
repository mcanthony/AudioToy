"use strict";

// Variable accessible by the user, containing functions and API stuff
var audiotoy = null;


function AudioToy() {

	this.apiFunctionNames = [
		"onGetSample"
	];

	this.playmode = 0;
	this.compiledCode = null;
	this.lastCodeChangeTime = 0;
	this.lastCompilationTime = 0;
	this.compilationDelay = 1000; // Milliseconds before compilation to occur after an edit
	this.t = 0;
	this.sampleRate = 44100;
}
AudioToy.prototype = {

	start: function() {

		console.log("start{");

		var self = this;

		// Create code editor
		this.editor = ace.edit("editor");
		this.editor.setTheme("ace/theme/monokai");
		this.editor.getSession().setMode("ace/mode/javascript");
		this.editor.on("change", function(e){
			console.log("Code changed");
			self.lastCodeChangeTime = Date.now();
		});

		// Create graphic context
		this.waveCanvas = document.getElementById("wave-canvas");
		this.canvasContext = this.waveCanvas.getContext("2d");

		// Compile base code
		this.compileCode();

		// Create audio context
		this.channelCount = 1;
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
		this.audioBuffer = this.audioContext.createBuffer(this.channelCount, 1*this.sampleRate, this.sampleRate);

		/*
		// Get an AudioBufferSourceNode.
		// This is the AudioNode to use when we want to play an AudioBuffer
		this.bufferSource = this.audioContext.createBufferSource();
		// connect the AudioBufferSourceNode to the
		// destination so we can hear the sound
		this.bufferSource.connect(this.audioContext.destination);
		// set the buffer in the AudioBufferSourceNode
		this.bufferSource.buffer = this.audioBuffer;
		*/

		this.bufferSource = this.audioContext.createScriptProcessor(4096, 0, 1);
		this.bufferSource.onaudioprocess = function(e) {
			var out = e.outputBuffer;
			for(var channel = 0; channel < out.numberOfChannels; ++channel) {
				var buffer = out.getChannelData(channel);
				self.executeCode(buffer);
			}
		}
		this.bufferSource.connect(this.audioContext.destination);

		// start the source playing
		//this.bufferSource.loop = true;
		//this.bufferSource.start();

		// Create analyser
		this.analyser = this.audioContext.createAnalyser();
		this.analyser.fftsize = 256;
		this.bufferSource.connect(this.analyser);
		// Initialize audio analysis buffers
		this.amplitudeData = new Uint8Array(this.analyser.frequencyBinCount);
		//this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

		this.mainLoop();

		console.log("}start");
	},

	compileCode: function() {
		// Get user code
		var code = this.editor.getValue();
		
		// Append it a return statement containing API functions implementations (defined or not in the code).
		// This is basically an object where is attribute is an implemented API callback or null.
		var memberDefs = [];
		for(var i = 0; i < this.apiFunctionNames.length; ++i) {
			var fname = this.apiFunctionNames[i];
			memberDefs.push(fname + ":(typeof " + fname + "=='function'?" + fname + ":null)");
		}
		var appendix = "\n return {" + memberDefs.join(',') + "};";
		code += appendix;

		this.lastCompilationTime = Date.now();

		var pack = null;

		try {
			// Execute the code and get the pack of API functions
			pack = new Function(code)();
		}
		catch(ex) {
			// Something failed when compiling the user's code
			console.log("Compilation failed: " + ex.message + "\n" + ex.stack);
			return false;
		}

		console.log("Compiled");
		this.compiledCode = pack;
		return true;
	},

	executeCode: function(buffer) {
		if(buffer == null) {
			return;
		}
		try{
			// Execute code
			if(this.compiledCode.onGetSample != null) {

				var onGetSample = this.compiledCode.onGetSample;
				var sampleDuration = 1.0 / this.sampleRate;

				for(var i = 0; i < buffer.length; ++i) {
					var out = onGetSample(this.t);
					var s = out[0];
					if(s > 1) s = 1;
					if(s < -1) s = -1;
					buffer[i] = s;
					this.t += sampleDuration;
				}
			}
			//console.log("Executed");
		}
		catch(ex) {
			console.log("Execution error: " + ex.message + "\n" + ex.stack);
		}
	},

	onPlayToggle: function() {

	},

	mainLoop: function() {
		var self = this;
		requestAnimationFrame(function() {
			self.mainLoop();
		});

		if(Date.now() - this.lastCodeChangeTime > this.compilationDelay && this.lastCodeChangeTime > this.lastCompilationTime) {
			this.compileCode();
			this.executeCode();
		}

		//var playOffset = this.bufferSource.

		this.analyser.getByteTimeDomainData(this.amplitudeData);
		this.renderWave();
	},

	renderWave: function() {
		var g = this.canvasContext;
		var canvas = this.waveCanvas;

		g.fillStyle = "#171814";
		g.fillRect(0, 0, canvas.width, canvas.height);

		g.strokeStyle = "#fa4";
		g.beginPath();

		var sliceWidth = canvas.width / this.amplitudeData.length;
		var x = 0;

		for(var i = 0; i < this.amplitudeData.length; i++) {

			var a = this.amplitudeData[i] / 128.0 - 1.0;

			var y = 1.5*a;

			y = 0.5 * (-y) + 1;
			y = y * canvas.height/2;
			if(i === 0) {
				g.moveTo(x, y);
			} else {
				g.lineTo(x, y);
			}

			x += sliceWidth;
		}

		g.lineWidth = 1;
		//g.lineTo(canvas.width, canvas.height/2);
		g.stroke();
	}

}


