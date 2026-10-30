layui.use(['echarts'], function() {
	let echarts = layui.echarts;

	var line4 = echarts.init(document.getElementById('line4'),null, {
		width: 600,
		height: 400
	});

	const colorList = ["#9E87FF", '#73DDFF', '#fe9a8b', '#F56948', '#9E87FF']
	option = {
		title: {
			text: '用电量'
		},
		tooltip: {
			trigger: 'axis'
		},
		legend: {
			data: ['2018', '2019']
		},
		grid: {
			left: '3%',
			right: '4%',
			bottom: '3%',
			containLabel: true
		},
		toolbox: {
			feature: {
				saveAsImage: {}
			}
		},
		xAxis: {
			type: 'category',
			boundaryGap: false,//坐标轴两边留白
			data: ['12201', '12202', '12203','12204','12301','12302','12303','12304','12401', '12402', '12403','12404'],
			axisLabel: { //坐标轴刻度标签的相关设置。
				interval: 0,//设置为 1，表示『隔一个标签显示一个标签』
			//	margin:15,
				
				color: '#1B253A',
				fontStyle: 'normal',
				fontFamily: '微软雅黑',
				fontSize: 12,
				
				formatter:function(params) {
					var newParamsName = "";
					var paramsNameNumber = params.length;
					var provideNumber = 4;  //一行显示几个字
					var rowNumber = Math.ceil(paramsNameNumber / provideNumber);
					if (paramsNameNumber > provideNumber) {
						for (var p = 0; p < rowNumber; p++) {
							var tempStr = "";
							var start = p * provideNumber;
							var end = start + provideNumber;
							if (p == rowNumber - 1) {
								tempStr = params.substring(start, paramsNameNumber);
							} else {
								tempStr = params.substring(start, end) + "\n";
							}
							newParamsName += tempStr;
						}
	
					} else {
						newParamsName = params;
					}
					return newParamsName
				},
				//rotate:50,
			},
			axisTick:{//坐标轴刻度相关设置。
				show: false,
			},
			axisLine:{//坐标轴轴线相关设置
				lineStyle:{
					color:'#E5E9ED',
					// opacity:0.2
				}
			},
			splitLine: { //坐标轴在 grid 区域中的分隔线。
				show: true,
				lineStyle: {
					color: '#E5E9ED',
				// 	opacity:0.1
				}
			}
		},
		yAxis: [
			{
				type: 'value',
				splitNumber: 5,
				axisLabel: {
					
					color: '#a8aab0',
					fontStyle: 'normal',
					fontFamily: '微软雅黑',
					fontSize: 12
					
				},
				axisLine:{
					show: false
				},
				axisTick:{
					show: false
				},
				splitLine: {
					show: true,
					lineStyle: {
						color: '#E5E9ED',
					// 	opacity:0.1
					}
				}
	
			}
		],
		series: [
			{
				name: '2018',
				type: 'line',
				itemStyle: {			       
					color:'#3A84FF',
					lineStyle: {
						color: "#3A84FF",
						width:1
					},
					areaStyle: { 
						color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [{
							offset: 0,
							color: 'rgba(58,132,255,0)'
						}, {
							offset: 1,
							color: 'rgba(58,132,255,0.35)'
						}]),
					}			        
				},
				data: [ 1, 2, 3, 3, 5, 6, 5, 3, 6, 5, 5, 4]
			},
			{
				name: '2019',
				type: 'line',
				itemStyle: {			       
					color:'rgba(255,80,124,1)',
					lineStyle: {
						color: "rgba(255,80,124,1)",
						width:1
					},
					areaStyle: { 
						color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [{
							offset: 0,
							color: 'rgba(255,80,124,0)'
						}, {
							offset: 1,
							color: 'rgba(255,80,124,0.35)'
						}]),
					}			        
				},
				data: [9, 5,7,8,6,7,8,7,7,6,8,6]
			}
		]
	};


	line4.setOption(option);

	window.onresize = function() {
		line4.resize();
	}
	
})
