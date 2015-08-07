var DEFAULT_TITLE_FILTER_REGEXP = /^\d+_\d{4}-\d{1,2}-\d{1,2}.log$/;

var fs = require('fs'),
    util = require('util'),
	events = require('events'),
	path = require('path');

var Reader = function(argus){
	var context = this;
//init
    //path: must exist
	if(typeof(argus.path) === 'undefined') throw 'need property "path" in argument object to construct Reader';
	this.path = argus.path;
	//reg: null:dont filter  undefined:default  set:set value
	this.title_filter_regexp = ((typeof(argus.title_filter_regexp) === 'undefined') ? DEFAULT_TITLE_FILTER_REGEXP : argus.title_filter_regexp);
	//battles: get result here after event 'finish'
	this.battles = [];
	this._file_num = 0;
	
	fs.readdir(path.join(this.path),function(err,titles){
		if(err) throw 'fail to read battle log dir(path:' + self.path + ')';
		context._phase_read_file(titles);
	});
	
	this._phase_read_file = function(titles){
		for(var i in titles){
			var title = titles[i];
			//regexp could be null(dont filter), but undefined is illegal here
			if(this.title_filter_regexp != undefined && !title.match(this.title_filter_regexp))
				continue;
			this._file_num++;
			fs.readFile(path.join(this.path,title),{encoding: 'utf-8'},function(err,data){
				if(err){
					console.error(err);
					context._phase_parse_finish();
				}
				else context._phase_parse(data);
			});
		}
	};
	
	this._phase_parse = function(data){
		var raw_battles = data.split('\n');
		for(var i in raw_battles){
			if(raw_battles[i] == '') continue;
			this.battles.push(JSON.parse(raw_battles[i]));
		}
		this._phase_parse_finish();
	};
	
	this._phase_parse_finish = function(){
		if(--this._file_num <= 0)
			this.emit('finish');
	};
}
util.inherits(Reader, events.EventEmitter);

module.exports = Reader;