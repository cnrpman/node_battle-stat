var Reader = require('./model/Reader.js'),
//json引入,visual studio code直接引json没自动补全
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
	var attacked_log = [-1,0,0,0,0,0,0,0,0,0,0,0,0],
		attacked_log_cover = [-1,0,0,0,0,0,0,0,0,0,0,0,0],
		mid_damaged_hit = 0,
		mid_damaged_hit_cover = 0,
		normal_hit = 0,//except mid_damaged
		normal_hit_cover = 0;
		
	var COVER_NUM = 3
//data-end
	totbattle = reader.battles.length;
	for(var battle_idx in reader.battles){
		var battle = reader.battles[battle_idx];
		//var battle = sample;

		var mapinfo = battle.mapInfo;
		var sally_deck = battle.kcdata_api_deck_at_pre_battle.kcdata_api_ship_sally_deck;
		var day_battle = battle.api_req_sortie_battle;
	//battle-filter
		// if(mapinfo == undefined)continue;
		// if(mapinfo.mapAreaId!=2 || mapinfo.mapInfoNo!=3)continue;//出击地图
		if(day_battle == undefined) continue; //有日战
		if(day_battle.api_hougeki1 == undefined) continue; //有炮击
		if(day_battle.api_formation[0] != 1) continue; //我方单纵
		//if(day_battle.api_support_flag == 0) continue;
		//if(day_battle.api_formation[1] != 1) continue; //敌方单纵
		//if(sally_deck.length != 3) continue; //我方进入战斗人数不少于6，以进入时为准，沉掉的会排除(deck包逻辑)
		//if(day_battle.api_ship_ke[6] == -1) continue; //敌方出击人数==6
	//filter-end
		var filterflag = 0;
		for(var enemy_idx = 1, enemy_num = day_battle.api_ship_ke.length; enemy_idx < enemy_num; ++enemy_idx){
		//enemy-filter
			//filterflag |= (env_ships[day_battle.api_ship_ke[enemy_idx]].api_stype == 13 ? 1 : 0)//if submarine
		//filter-end
		}
		if(filterflag) continue;

		filterflag = 0;
		for(var kanmusu_idx = 1, kanmusu_num = sally_deck.length; kanmusu_idx < kanmusu_num; ++kanmusu_idx){
		//friendly-filter
			var stype = env_ships[sally_deck[kanmusu_idx].charId].api_stype;
			filterflag |= ((stype == 13 || stype == 14)  ? 0 : 1);
		//filter-end
		}
		if(filterflag) continue;



	//reduce
		hitbattle++;
    	var cur_hp = day_battle.api_nowhps.slice(),
		    max_hp = day_battle.api_maxhps;
	//开幕空袭
		if(day_battle.api_kouku != undefined && day_battle.api_kouku.api_stage3 != undefined){//stage 3 exist
			var op_air_attack = day_battle.api_kouku.api_stage3;
			
			var enemy_dam = op_air_attack.api_edam;
			for(var idx = 1; idx <= 6; ++idx){
				if(idx == 0) continue;
				cur_hp[idx+6] -= Math.floor(enemy_dam[idx]);
			}
			
			var friendly_dam = op_air_attack.api_fdam;
			for(var idx = 1; idx <= 6; ++idx){
				if(idx == 0) continue;
				cur_hp[idx] -= Math.floor(friendly_dam[idx]);
			}
		}
    //开幕雷击
		if(day_battle.api_opening_attack){
			var op_tope_attack = day_battle.api_opening_attack;
			
			var enemy_dam = op_tope_attack.api_edam;
			for(var idx = 1; idx <= 6; ++idx){
				if(idx == 0) continue;
				cur_hp[idx+6] -= Math.floor(enemy_dam[idx]);
			}
			
			var friendly_dam = op_tope_attack.api_fdam;
			for(var idx = 1; idx <= 6; ++idx){
				if(idx == 0) continue;
				cur_hp[idx] -= Math.floor(friendly_dam[idx]);
			}
		}
	//炮击战
		var coverable = 0;
		for(var kanmusu_idx = 2; kanmusu_idx <=6; kanmusu_idx++){
			if(max_hp[kanmusu_idx] > 0 && cur_hp[kanmusu_idx]/max_hp[kanmusu_idx] > 0.7500000001)
				coverable++;
		}
		
		var hougekis = [];
		hougekis[0] = day_battle.api_hougeki1;
		if(day_battle.api_hougeki2 != undefined)
			hougekis[1] = day_battle.api_hougeki2;
		if(day_battle.api_hougeki3 != undefined)
			hougekis[2] = day_battle.api_hougeki3;

		for(var turn_idx = 0, turn_len = hougekis.length; turn_idx < turn_len; ++turn_idx){//hougeki = 第turn_idx轮炮击
			var hougeki = hougekis[turn_idx];
			for(var seq_idx = 1, seq_len = hougeki.api_df_list.length; seq_idx < seq_len; ++seq_idx){//第seq_idx个攻击次序
				for(var hit_idx = 0, hit_num = hougeki.api_df_list[seq_idx].length; hit_idx < hit_num; ++hit_idx){//第hit_idx个攻击(单击/连击)
				//单次攻击
					var target_pos = hougeki.api_df_list[seq_idx][hit_idx],
						//source_pos = hougeki.api_at_list[seq_idx],
					    //hit_type = hougeki.api_at_type[seq_idx],
						damage = Math.floor(hougeki.api_damage[seq_idx][hit_idx]);//necessary
						
					var is_cover = (hougeki.api_damage[seq_idx][hit_idx] != damage),
					    //is_target_mid_damage = (cur_hp[target_pos]/max_hp[target_pos]<0.500000001),
						is_flagship_mid_damage = (cur_hp[1]/max_hp[1]<0.750000001)
						
					//console.log(hougeki.api_damage[seq_idx][hit_idx]+' '+damage+' '+is_cover);
						
					if(target_pos<=6){//friendly only
					//filter
					//filter-end
						
					//log...
						attacked_log[target_pos]++;
						attacked_log_cover[is_cover?1:target_pos]++;//friendly cover
						if(coverable == COVER_NUM){
							if(is_flagship_mid_damage){
								if(target_pos == 1){
									mid_damaged_hit ++;
								}
								else if(is_cover){
									mid_damaged_hit ++;
									mid_damaged_hit_cover ++;
								}
							}
							else{
								if(target_pos == 1){
									normal_hit++;
								}
								else if(is_cover){
									normal_hit++;
									normal_hit_cover++;
								}
							}
						}
					//log end
					}
					
					//flush status
					var last_hp = cur_hp[target_pos];
					cur_hp[target_pos] -= damage;
					if(target_pos!=1 && target_pos <=6 && last_hp/max_hp[target_pos] > 0.750000001 && cur_hp[target_pos]/max_hp[target_pos] < 0.750000001)
						coverable--;
				//单次攻击 end
				}
			}
		}
	//炮击战 end
	}
	console.log('after filter/total battles: '+hitbattle+'/'+totbattle);
	console.log(attacked_log);
	console.log(attacked_log_cover);
	console.log('coverable: '+COVER_NUM);
	console.log('Normal:'+normal_hit_cover+'/'+normal_hit);
	console.log('Mid_damaged:'+mid_damaged_hit_cover+'/'+mid_damaged_hit);
});