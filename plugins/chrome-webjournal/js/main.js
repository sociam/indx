function WAISPulse(){

	var drawingCanvas;
	this.people = [];
	var timelineHeight;
	var stepping = 60000;
	var xoffset = 40;
	
	this.init = function(){
		//parseWAISList();
		this.generateCanvas();
		
		//this.drawGraphs();
		
		this.getPeople();
	}

	this.parseWAISList = function(){
		$.getJSON("server/cache/ecs-lsl.json", function(data){
			console.log(data);
		});
	}
	
	this.generateCanvas = function() {
		drawingCanvas = Raphael(10, 50, 1000, 1000);
		drawingCanvas.path("M10 0L10 1000");
		drawingCanvas.path("M10 1000L1000 1000");
		
		this.timelineHeight = (drawingCanvas.height - (drawingCanvas.height * 0.20)) / window.Peoples.length;
		
		for(i=1;i< 24; i++){
			this.drawNotch( i * (drawingCanvas.width / 24) );
		}
	}
	
	this.getPeople = function(){
		var now = new Date().valueOf();
		var yesterday = (new Date().valueOf() - 24*60*60*1000);
	
		for(var i=0; i < window.Peoples.length; i++){
			var person = window.Peoples.at(i);
			
			var timeline = this.drawTimeline(person, window.Peoples.length);
			
			var heights = [];
			
			for(var t = yesterday; t < now; t+=stepping){
				var activities = window.Activities.from_at(person, t).length;
				heights.push(activities);
			}
			
			console.log(timeline);
			
			var maxHeight = Math.max.apply(Math.max, heights);
			
			t = yesterday;
			
			var svgStr = "M" + xoffset + "," + (timeline.y + this.timelineHeight) + " ";
			
			for(var h in heights){
				var y = Math.floor(timeline.y + this.timelineHeight - 	heights[h] * ( this.timelineHeight / maxHeight ));
				var x = Math.floor((drawingCanvas.width / (24*60*60*1000)) * (t - yesterday));
				
				svgStr += "L" + x + "," + y + " ";
				
				t += stepping;
			}
			
			drawingCanvas.path(svgStr);
			
			
			
		}
	}
	
	this.drawGraphs = function(){
		// Draw path
		var firstLine = this.drawLine(30, 300);
		
		var secondLine = this.drawLine(100, 300);
	}
	
	this.drawTimeline = function(person, dist){
		var timelineY = (this.timelineHeight * this.people.length) + drawingCanvas.height * 0.05;
		
		var timeline = this.drawLine(timelineY, 1000);
		
		timeline.y = timelineY;
		
		this.people.push(person);
		return timeline;
	}
	
	this.drawLine = function(y, length){
		return drawingCanvas.path("M" + xoffset + "," + y + " L" + length + " " + y);
	}
	
	this.drawNotch = function(x) {
		drawingCanvas.path("M" + x + " 990L" + x + " 1000");
	}
	
	this.drawActivity = function(x, height){
		drawingCanvas.path("M200,300 Q400,50 600,300 T1000,300");
	}
	
	this.addInteraction = function(){
	
	}

}