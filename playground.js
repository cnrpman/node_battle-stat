var Reader = require('./model/Reader.js'),
//json引入,VSC直接引json没自动补全
    //直接采用poi的环境数据($ships,$slotitems),以供api_id反查
	env_ships = require('./assets/env.ships.json.js'),
	env_items = require('./assets/env.items.json.js'),
	//样例战斗包供自动补全用
	sample = require('./assets/sample.json.js');

var lastdate = (new Date()).valueOf();
console.log('TimeStamp::Reader_construct: '+lastdate+' 0ms');

var reader = new Reader({
	path:'C:\\Users\\JUN\\AppData\\Roaming\\poi\\battle-records',
	title_filter_regexp: null//null:不设置标题过滤
})

reader.on('finish',function(){
	var curdate=(new Date()).valueOf();
	console.log('TimeStamp::Reader_construct_finish: '+curdate+' '+(curdate-lastdate)+'ms');
	var hitbattle = 0,
	    totbattle = 0;

//custom data
	var attacked_log = [-1,0,0,0,0,0,0,0,0,0,0,0,0];
//data-end
	totbattle = reader.battles.length;
	for(var battle_idx in reader.battles){
		var battle = reader.battles[battle_idx];
		//var battle = sample;

		var mapinfo = battle.mapInfo;
		var sally_deck = battle.kcdata_api_deck_at_pre_battle.kcdata_api_ship_sally_deck;
		var day_battle = battle.api_req_sortie_battle;
	//battle-filter
		//if(mapinfo.mapAreaId!=5 || mapinfo.mapInfoNo!=4)continue;//出击地图
		if(day_battle == undefined) continue; //有日战
		if(day_battle.api_hougeki1 == undefined) continue; //有炮击
		if(day_battle.api_formation[0]!=1) continue; //我方单纵
		//if(day_battle.api_formation[1] != 1) continue; //敌方单纵
		if(sally_deck.length!=6) continue; //我方出击人数==6
		//if(day_battle.api_ship_ke[6] == -1) continue; //敌方出击人数==6
	//filter-end
		var filterflag = 0;
		for(var enemy_idx in day_battle.api_ship_ke){
			if(enemy_idx == 0)continue;
		//enemy-filter
			//filterflag |= (env_ships[day_battle.api_ship_ke[enemy_idx]].api_stype == 13 ? 1 : 0)//if submarine
		//filter-end
		}
		if(filterflag) continue;

		filterflag = 0;
		for(var kanmusu_idx in sally_deck){
			if(kanmusu_idx == 0)continue;
		//friendly-filter
			filterflag |= (env_ships[sally_deck[kanmusu_idx].charId].api_stype == 13 ? 1 : 0);
		//filter-end
		}
		if(filterflag) continue;



	//reduce
		hitbattle++;

		var attacked_dat = [];
		attacked_dat[0] = day_battle.api_hougeki1.api_df_list;
		if(day_battle.api_hougeki2 != undefined)
			attacked_dat[1] = day_battle.api_hougeki2.api_df_list

		for(var turn_idx in attacked_dat){//第turn_idx轮炮击
			for(var seq_idx in attacked_dat[turn_idx]){//第seq_idx个攻击次序
				if(seq_idx == 0)continue;
				for(var hit_idx in attacked_dat[turn_idx][seq_idx]){//第hit_idx个攻击(单击/连击)
					var target_id = attacked_dat[turn_idx][seq_idx][hit_idx];
				//filter
					if(target_id>6) continue;//只保留我方数据
					//if(target_id<=6) continue;
				//filter-end
					attacked_log[target_id]++;
				}
			}
		}
	}

	console.log('after filter/total battles: '+hitbattle+'/'+totbattle);
	console.log(attacked_log);
});