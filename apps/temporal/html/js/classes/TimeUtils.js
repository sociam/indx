function TimeUtils()
{
	this.dayLight = [];	
	for(var x=0;x<24;x++)
	{
		this.dayLight.push(1-(-Math.cos(x*2/23*Math.PI)+1)/2+((-Math.cos (x*4*Math.PI/23))+1)/10);
	}
}

TimeUtils.prototype.dayColor = function(instant, color)
{
	var x = new Date(instant).getHours();
	var color = tEngine.hexToRgb(color);
	alpha = this.dayLight[x];
	return "rgba("+color.r+","+color.g+","+color.b+","+alpha/10+")";
}

TimeUtils.toMidnight = function(instant)
{
	var midnight = new Date(instant);
    midnight.setHours( 24 );
    midnight.setMinutes( 0 );
    midnight.setSeconds( 0 );
    midnight.setMilliseconds( 0 );

    return new Date(Number(midnight)-Number(instant));
}

TimeUtils.toIntervalString = function(interval)
{
	var days = parseInt(Number(interval)/Number(TimeUtils.days(1)));
	var hours = parseInt(Number(interval)/Number(TimeUtils.hours(1)))%24;
	var minutes = parseInt(Number(interval)/Number(TimeUtils.minutes(1)))%60;
	var seconds = parseInt(Number(interval)/Number(TimeUtils.seconds(1)))%60;
	var string = days+" days "+TimeUtils.fillZeros(hours, 2)+":"+TimeUtils.fillZeros(minutes, 2)+":"+TimeUtils.fillZeros(seconds, 2);
	return string;
}

TimeUtils.dateFormatter = function(date)
{
	date = new Date(date);
	var f = this.fillZeros;
	var beginStr = f(date.getDate(), 2)+"/"+f(date.getMonth()+1,2)+"/"+f(date.getFullYear(),2)+" "+f(date.getHours(),2)+":"+f(date.getMinutes(),2)+":"+f(date.getSeconds(),2);
	return beginStr;
}

TimeUtils.fillZeros = function(str, n)
{
	str = str.toString();
	while(str.length < n)
	{
		str = "0"+str;
	}
	return str;
}

TimeUtils.parseISO8601 = function (string) {
    var regexp = "([0-9]{4})(-([0-9]{2})(-([0-9]{2})" +
        "(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.([0-9]+))?)?" +
        "(Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?";
    var d = string.match(new RegExp(regexp));

    var offset = 0;
    var date = new Date(d[1], 0, 1);

    if (d[3]) { date.setMonth(d[3] - 1); }
    if (d[5]) { date.setDate(d[5]); }
    if (d[7]) { date.setHours(d[7]); }
    if (d[8]) { date.setMinutes(d[8]); }
    if (d[10]) { date.setSeconds(d[10]); }
    if (d[12]) { date.setMilliseconds(Number("0." + d[12]) * 1000); }
    if (d[14]) {
        offset = (Number(d[16]) * 60) + Number(d[17]);
        offset *= ((d[15] == '-') ? 1 : -1);
    }

    offset -= date.getTimezoneOffset();
    time = (Number(date) + (offset * 60 * 1000));
    return new Date(time);
}

TimeUtils.mostConvenientTimeScale = function(interval)
{
	interval *= 1000;
	if(+(interval) < +(this.hours(1)))
		return this.minutes(1);
	else if(interval < this.hours(3))
		return this.minutes(15);
	else if(interval < this.hours(12))
		return this.minutes(30);
	else if(interval < this.days(2))
		return this.hours(1);

	return this.hours(3);
}

TimeUtils.days = function(days)
{
	return 86400000*days;
}

TimeUtils.hours = function(hours)
{
	return 3600000*hours;
}

TimeUtils.minutes = function(minutes)
{
	return 60000*minutes;
}

TimeUtils.seconds = function(seconds)
{
	return 1000*seconds;
}

TimeUtils.roundMinute = function(time)
{
	var diff = +(time)%60000;
	return new Date(+(time)-diff);
}

TimeUtils.roundMinuteUp = function(time)
{
	var diff = +(time)%60000;
	return new Date(+(time)+(60000-diff));
}

TimeUtils.roundHour = function(time)
{
	var diff = +(time)%3600000;
	return new Date(+(time)-diff);
}

TimeUtils.roundHourUp = function(time)
{
	var diff = +(time)%3600000;
	return new Date(+(time)+(3600000-diff));
}

TimeUtils.setDateMinusDays = function(date, days, target)
{
	target.end = new Date(date);

	if(days >= 1)
		target.begin = new Date().setDate(target.end.getDate()-days);
	else
		target.begin = new Date(target.end - 86400000*days);
	if(target.iType == "TimeInterval")
	{
		target.updateInterval();
	}
}