layui.use(['echarts'], function() {
	let echarts = layui.echarts;
	var line1 = echarts.init(document.getElementById('line1'),null, {
		width: 600,
		height: 400
	});

	const colorList = ["#9E87FF", '#73DDFF', '#fe9a8b', '#F56948', '#9E87FF']
	option = {
		
				backgroundColor: '#fff',
				tooltip: {
					show: false
				},
				grid: {
					top: '10%',
					bottom: '6%',
					left: '6%',
					right: '6%',
					containLabel: true
				},
				xAxis: [{
					type: 'category',
					boundaryGap: false,
					axisLine: {
						show: false
					},
					axisTick: {
						show: false
					},
					axisLabel: {
						margin: 10,	                    
						fontSize: 14,
						color: 'rgba(#999)'	                   
					},
					splitLine: {
						show: true,
						lineStyle: {
							color: '#939ab6',
							opacity: .15
						}
					},
					data: ['10:00', '10:10', '10:10', '10:30', '10:40', '10:50']
				},],
				yAxis: [{
					type: 'value',
					offset: 15,
					max: 100,
					min: 0,
					axisTick: {
						show: false
					},
					axisLine: {
						show: false
					},
					axisLabel: {
						margin: 10,	                    
						fontSize: 14,
						color: '#999'
					
					},
					splitLine: {
						show: false
					}
	
				}],
				series: [{
					name: '2',
					type: 'line',
					z: 3,
					showSymbol: false,
					smoothMonotone: 'x',
					lineStyle: {
							width: 3,
							color: {
								type: 'linear',
								x: 0,
								y: 0,
								x2: 0,
								y2: 1,
								colorStops: [{
									offset: 0, color: 'rgba(59,102,246)' // 0% 处的颜色
								}, {
									offset: 1, color: 'rgba(118,237,252)' // 100% 处的颜色
								}]
							},
							shadowBlur: 4,
							shadowColor: 'rgba(69,126,247,.2)',
							shadowOffsetY: 4
					},
					areaStyle: {	                    
						color: {
							type: 'linear',
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [{
								offset: 0, color: 'rgba(227,233,250,.9)' // 0% 处的颜色
							}, {
								offset: 1, color: 'rgba(248,251,252,.3)' // 100% 处的颜色
							}]
						}	                   
					},
					smooth: true,
					data: [20, 56, 17, 40, 68, 42]
				},{
					name: '1',
					type: 'line',
					showSymbol: false,
					smoothMonotone: 'x',
	
					lineStyle: {
							width: 3,
							color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
								offset: 0,
								color: 'rgba(255,84,108)'
							}, {
								offset: 1,
								color: 'rgba(252,140,118)'
							}], false),
							shadowBlur: 4,
							shadowColor: 'rgba(253,121,128,.2)',
							shadowOffsetY: 4
					},
					areaStyle: {
							color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{
								offset: 0,
								color: 'rgba(255,84,108,.15)'
							}, {
								offset: 1,
								color: 'rgba(252,140,118,0)'
							}], false),
					},
					smooth: true,
					data: [20, 71, 8, 50, 57, 32]
				}
			]
			
	};

	line1.setOption(option);

	window.onresize = function() {
		line1.resize();
	}
	
})
