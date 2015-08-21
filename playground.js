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
		
	var damaged_judge = function(nowhp,maxhp){
		var ratio = nowhp / maxhp;
		     if(nowhp == maxhp)    return -1;//full
		else if(ratio > 0.7500001) return  0;//non
		else if(ratio > 0.5000001) return  1;//lite
		else if(ratio > 0.2500001) return  2;//medium
		else if(nowhp > 0.0)       return  3;//crit
		else                       return  4;//sunk
	}

//custom data
	var enemy_attacked_log = [//[enemy_alive]
		null,
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0]
	],
	    enemy_alived_log = [//[enemy_alive]
		null,
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0],
		[0,0,0,0,0,0,0,0,0,0,0,0,0]
	];
		
//data-end
	totbattle = reader.battles.length;
	for(var battle_idx in reader.battles){
		var battle = reader.battles[battle_idx];
		//var battle = sample;

		var mapinfo = battle.mapInfo;
		var sally_deck = battle.kcdata_api_deck_at_pre_battle.kcdata_api_ship_sally_deck;
		var day_battle = battle.api_req_sortie_battle;
	//battle-filter
		//if(mapinfo == undefined || mapinfo.mapAreaId!= 5 || mapinfo.mapInfoNo!= 4)continue;//出击地图
		if(day_battle == undefined) continue; //有日战
		if(day_battle.api_hougeki1 == undefined) continue; //有炮击
		//if(day_battle.api_formation[0] != 1) continue; //我方单纵
		if(day_battle.api_support_flag != 0) continue;
		if(day_battle.api_formation[1] != 1) continue; //敌方阵型 1.单纵 2.复 3.轮
		//if(sally_deck.length != 6) continue; //我方进入战斗人数不少于6，以进入时为准，沉掉的会排除(deck包逻辑)
		if(day_battle.api_ship_ke[6] == -1 || day_battle.api_ship_ke[6] == -1) continue; //敌方出击人数==6
	//filter-end
		var filterflag = 0;
		for(var enemy_idx = 1, enemy_num = day_battle.api_ship_ke.length; enemy_idx < enemy_num; ++enemy_idx){
		//enemy-filter
			if(day_battle.api_ship_ke[enemy_idx] == -1)break;
			var stype = env_ships[day_battle.api_ship_ke[enemy_idx]].api_stype;
			filterflag |= ((stype == 13 || stype == 14)  ? 1 : 0);//1:0 non-SS   0:1 SS only
		//filter-end
		}
		if(filterflag) continue;

		filterflag = 0;
		for(var kanmusu_idx = 1, kanmusu_num = sally_deck.length; kanmusu_idx < kanmusu_num; ++kanmusu_idx){
		//friendly-filter
			// var stype = env_ships[sally_deck[kanmusu_idx].charId].api_stype;
			// filterflag |= ((stype == 13 || stype == 14)  ? 1 : 0);//1:0 non-SS   0:1 SS only
		//filter-end
		}
		if(filterflag) continue;



	//reduce
		hitbattle++;
    	var cur_hp = day_battle.api_nowhps.slice(),
		    max_hp = day_battle.api_maxhps;
	//开幕空袭
		if(day_battle.api_stage_flag[2]==1){//stage 3 exist
			var op_air_attack = day_battle.api_kouku.api_stage3;
			
			var enemy_dam = op_air_attack.api_edam;
			for(var idx = 1; idx <= 6; ++idx)
				cur_hp[idx+6] -= Math.floor(enemy_dam[idx]);
			
			var friendly_dam = op_air_attack.api_fdam;
			for(var idx = 1; idx <= 6; ++idx)
				cur_hp[idx] -= Math.floor(friendly_dam[idx]);
		}
    //开幕雷击
		if(day_battle.api_opening_flag==1){
			var op_tope_attack = day_battle.api_opening_atack;
			
			var enemy_tope_dam = op_tope_attack.api_edam;
			for(var idx = 1; idx <= 6; ++idx)
				cur_hp[idx+6] -= Math.floor(enemy_tope_dam[idx]);
			
			var friendly_tope_dam = op_tope_attack.api_fdam;
			for(var idx = 1; idx <= 6; ++idx)
				cur_hp[idx] -= Math.floor(friendly_tope_dam[idx]);
		}
	//炮击战
		//realtime status init
		var realtime_friendly_coverable = 0,
			realtime_enemy_alive = 0;
			
		for(var pos = 1; pos <=12; pos++){
			if(max_hp[pos]<=0)continue;
			if(pos <=6){//friendly
				if(pos != 1 && damaged_judge(cur_hp[pos],max_hp[pos]) <= 0)
					++realtime_friendly_coverable;
			}
			else{//enemy
				if(damaged_judge(cur_hp[pos],max_hp[pos]) < 4)
					++realtime_enemy_alive;
			}
		}
		//init end
		
		console.log();
		var hougekis = [];
		hougekis[0] = day_battle.api_hougeki1;
		if(day_battle.api_hougeki2 != undefined)
			hougekis[1] = day_battle.api_hougeki2;
		if(day_battle.api_hougeki3 != undefined)
			hougekis[2] = day_battle.api_hougeki3;
			
		for(var turn_idx = 0, turn_len = hougekis.length; turn_idx < turn_len; ++turn_idx){//hougeki = 第turn_idx轮炮击
			var hougeki = hougekis[turn_idx];
			for(var seq_idx = 1, seq_len = hougeki.api_df_list.length; seq_idx < seq_len; ++seq_idx){//第seq_idx个攻击次序
				var target_sunk_by_last_combo_hit = false;
				for(var hit_idx = 0, hit_num = hougeki.api_df_list[seq_idx].length; hit_idx < hit_num; ++hit_idx){//第hit_idx个攻击(单击/连击)
				//单次攻击
					var target_pos = hougeki.api_df_list[seq_idx][hit_idx],
						source_pos = hougeki.api_at_list[seq_idx],
					    //hit_type = hougeki.api_at_type[seq_idx],
						damage = Math.floor(hougeki.api_damage[seq_idx][hit_idx]);//necessary
						
					var is_cover = (hougeki.api_damage[seq_idx][hit_idx] != damage);
					    //is_target_mid_damage = (cur_hp[target_pos]/max_hp[target_pos]<0.500000001),
						//is_flagship_mid_damage = (damaged_judge(cur_hp[1],max_hp[1]) >= 2);
						
					var	alive_before_target = 0;
					if(target_pos <= 6){
						for(var pos = target_pos-1; pos >= 1; pos--){
							if(damaged_judge(cur_hp[pos],max_hp[pos])<4)
								alive_before_target++;
						}
					}
					else{
						for(var pos = target_pos-1; pos >= 7; pos--){
							if(damaged_judge(cur_hp[pos],max_hp[pos])<4)
								alive_before_target++;
						}
					}						
					if(target_pos<=6){//friendly
					//filter
					//filter-end	
						;
					}
					else{//enemy
						//log
						if(hit_idx == 0){
							enemy_attacked_log[realtime_enemy_alive][(is_cover? 0 : alive_before_target)]++;
							//enemy_attacked_log[realtime_enemy_alive][alive_before_target]++;
						}
						//log-end
					}
					
					//realtime status flush
					if(target_pos>6)
						console.log('a'+realtime_enemy_alive+' b'+alive_before_target+'['+cur_hp.slice(7,13) + '] target: ('+target_pos+')'+env_ships[day_battle.api_ship_ke[target_pos-6]].api_name + ' damage: '+damage + ' from: '+source_pos);
					 else console.log('a'+realtime_enemy_alive+' b'+alive_before_target+'['+cur_hp.slice(1,7) + '] target: ('+target_pos+')'+env_ships[sally_deck[target_pos-1].charId].api_name + ' damage: '+damage + ' from: '+source_pos)
					
					var last_hp = cur_hp[target_pos];
					cur_hp[target_pos] -= damage;
					var target_lite_damaged = (damaged_judge(last_hp,max_hp[target_pos]) < 1 && damaged_judge(cur_hp[target_pos],max_hp[target_pos]) >= 1),
						target_sunk		    = (damaged_judge(last_hp,max_hp[target_pos]) < 4 && damaged_judge(cur_hp[target_pos],max_hp[target_pos]) >= 4);
					if(target_pos <= 6){//friendly
						if(target_pos!=1 && target_lite_damaged)
							realtime_friendly_coverable--;
					}
					else{//enemy
						if(target_sunk){
							realtime_enemy_alive--;
							target_sunk_by_last_combo_hit = true;
						}
					}
					//flush-end
				//单次攻击 end
				}
			}
		}
	//炮击战 end
	}
	console.log('after filter/total battles: '+hitbattle+'/'+totbattle);
	console.log('alive,1,2,3,4,5,6');
	for(var i = 1;i <= 6;i++)
		console.log(i + ',' + enemy_attacked_log[i].slice(0,7));
});