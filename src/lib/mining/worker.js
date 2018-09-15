/*
 * Copyright (c) 2018, Gnock
 * Copyright (c) 2018, The Masari Project
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* Very simple worker which tries to find a nonce value to create a cryptonight-hash which
 * is lower than the given target. */
console.log('LOADED');
importScripts('cn2.js'); // imports the cn.js "glue" script generated by emscripten

// webassembly cryptonight is called here.
var cn = Module.cwrap('hash_cn', 'string', ['string', 'string', 'number', 'number']);

// A few helper (string) functions to help us working with the hex string
// which is used

function zeroPad(num, places) {
	var zero = places - num.toString().length + 1;
	return Array(+(zero > 0 && zero)).join("0") + num;
}

function hex2int(s) {
	return parseInt(s.match(/[a-fA-F0-9]{2}/g).reverse().join(''), 16);
}

function int2hex(i) {
	return (zeroPad(i.toString(16), 8)).match(/[a-fA-F0-9]{2}/g).reverse().join('');
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

var hashCount = 0;

var lastTime = Date.now()/1000;

var jbthrt = null;
var isRunning = false;

function calcJob(){
	var job = jbthrt.job;
	// console.log(job);
	var thrt = jbthrt.throttle;

	var bsuccess = false;
	var hash = "";
	var hexnonce = 0;

	// calculate a cryptonight hash
	var calcHash = function () {
		// console.log('cal hash');
		if (job !== null) {

			var target = hex2int(job.target);
			var inonce = getRandomInt(0, 0xFFFFFFFF);
			hexnonce = int2hex(inonce);

			// console.log('blob',job.blob);
			// console.log('variant',job.variant);
			// console.log('algo',job.algo);

			try {
				if(job.algo === "cn")
					hash = cn(job.blob, hexnonce, 0, job.variant);
				else if(job.algo === "cn-lite")
					hash = cn(job.blob, hexnonce, 1, job.variant);
				else throw "algorithm not supported!";

				var hashval = hex2int(hash.substring(56, 64));
				// console.log('target', hashval, target);
				bsuccess = hashval < target;

				postMessage("hash");
			}
			catch (err) { console.log(err); }


		}
	};

	// submit a cryptonight hash
	var submit = function () {
		// console.log('submiting work');
		if (bsuccess && jbthrt.job.job_id === job.job_id) {//check if the job has not changed
			console.log(jbthrt.job.job_id,job.job_id);
			var msg = {
				identifier: "solved",
				job_id: job.job_id,
				nonce: hexnonce,
				result: hash
			};
			postMessage(JSON.stringify(msg));
		}

		if(isRunning)
			setTimeout(calcJob,0);
		// onmessage(e);
	};

	if (thrt === 0) { calcHash(); submit(); }
	else {
		var t0 = performance.now();
		calcHash();
		var dt = performance.now() - t0;

		var sleept = Math.round(thrt / (100 - thrt + 10) * dt);
		setTimeout(submit, sleept);
	}

	++hashCount;
	if(hashCount%200===0) {
		var now = Date.now()/1000;
		console.log(hashCount, 200/(now-lastTime));
		lastTime = now;
	}
}


onmessage = function (e) {
	// console.log('message',e);

	jbthrt = e.data;
	if(jbthrt === null)
		isRunning = false;
	else if(!isRunning){
		isRunning = true;
		calcJob();
	}

};