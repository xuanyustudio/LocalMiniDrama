layui.use(['echarts'], function() {
	let echarts = layui.echarts;
	var line2 = echarts.init(document.getElementById('line2'),null, {
		width: 600,
		height: 400
	});

	const colorList = ["#9E87FF", '#73DDFF', '#fe9a8b', '#F56948', '#9E87FF']
	option = {
		backgroundColor: '#fff',
		title: {
			text: '全国6月销售统计',
			fontSize: 12,
			fontWeight: 400,
			left: 'center',
			top: '5%'
		},
		legend: {
			icon: 'circle',
			top: '5%',
			right: '5%',
			itemWidth: 6,
			itemGap: 20,
			color: '#556677'
		},
		tooltip: {
			trigger: 'axis',
			axisPointer: {
				label: {
					show: true,
					backgroundColor: '#fff',
					color: '#556677',
					borderColor: 'rgba(0,0,0,0)',
					shadowColor: 'rgba(0,0,0,0)',
					shadowOffsetY: 0
				},
				lineStyle: {
					width: 0
				}
			},
			backgroundColor: '#fff',
			color: '#5c6c7c',
			padding: [10, 10],
			extraCssText: 'box-shadow: 1px 0 2px 0 rgba(163,163,163,0.5)'
		},
		grid: {
			top: '15%'
		},
		xAxis: [{
			type: 'category',
			data: ['北京', '上海', '广州', '深圳', '香港', '澳门', '台湾'],
			axisLine: {
				lineStyle: {
					color: '#DCE2E8'
				}
			},
			axisTick: {
				show: false
			},
			axisLabel: {
				interval: 0,
				color: '#556677',
				// 默认x轴字体大小
				fontSize: 12,
				// margin:文字到x轴的距离
				margin: 15
			},
			axisPointer: {
				label: {
					// padding: [11, 5, 7],
					padding: [0, 0, 10, 0],

					// 这里的margin和axisLabel的margin要一致!
					margin: 15,
					// 移入时的字体大小
					fontSize: 12,
					backgroundColor: {
						type: 'linear',
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [{
							offset: 0,
							color: '#fff' // 0% 处的颜色
						}, {
							// offset: 0.9,
							offset: 0.86,

							color: '#fff' // 0% 处的颜色
						}, {
							offset: 0.86,
							color: '#33c0cd' // 0% 处的颜色
						}, {
							offset: 1,
							color: '#33c0cd' // 100% 处的颜色
						}],
						global: false // 缺省为 false
					}
				}
			},
			boundaryGap: false
		}],
		yAxis: [{
			type: 'value',
			axisTick: {
				show: false
			},
			axisLine: {
				show: true,
				lineStyle: {
					color: '#DCE2E8'
				}
			},
			axisLabel: {
				color: '#556677',
			},
			splitLine: {
				show: false
			}
		}, {
			type: 'value',
			position: 'right',
			axisTick: {
				show: false
			},
			axisLabel: {
				color: '#556677',
				formatter: '{value}'
			},
			axisLine: {
				show: true,
				lineStyle: {
					color: '#DCE2E8'
				}
			},
			splitLine: {
				show: false
			}
		}],
		series: [{
				name: 'Adidas',
				type: 'line',
				data: [10, 10, 30, 12, 15, 3, 7],
				symbolSize: 1,
				symbol: 'circle',
				smooth: true,
				yAxisIndex: 0,
				showSymbol: true,
				lineStyle: {
					width: 5,
					color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [{
							offset: 0,
							color: '#9effff'
						},
						{
							offset: 1,
							color: '#9E87FF'
						}
					]),
					shadowColor: 'rgba(158,135,255, 0.3)',
					shadowBlur: 10,
					shadowOffsetY: 20
				},
				itemStyle: {
					color: colorList[0],
					borderColor: colorList[0]
				}
			}, {
				name: 'Nike',
				type: 'line',
				data: [5, 12, 11, 14, 25, 16, 10],
				symbolSize: 1,
				symbol: 'circle',
				smooth: true,
				yAxisIndex: 0,
				showSymbol: true,
				lineStyle: {
					width: 5,
					color: new echarts.graphic.LinearGradient(1, 1, 0, 0, [{
							offset: 0,
							color: '#73DD39'
						},
						{
							offset: 1,
							color: '#73DDFF'
						}
					]),
					shadowColor: 'rgba(115,221,255, 0.3)',
					shadowBlur: 10,
					shadowOffsetY: 20
				},
				itemStyle: {					
					color: colorList[1],
					borderColor: colorList[1]					
				}
			},
			{
				name: '老北京布鞋',
				type: 'line',
				data: [150, 120, 170, 140, 500, 160, 110],
				symbolSize: 1,
				yAxisIndex: 1,
				symbol: 'circle',
				smooth: true,
				showSymbol: true,
				lineStyle: {
					width: 5,
					color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{
							offset: 0,
							color: '#fe9a'
						},
						{
							offset: 1,
							color: '#fe9a8b'
						}
					]),
					shadowColor: 'rgba(254,154,139, 0.3)',
					shadowBlur: 10,
					shadowOffsetY: 20
				},
				itemStyle: {					
					color: colorList[2],
					borderColor: colorList[2]					
				}
			}
		]
	};

	line2.setOption(option);

	window.onresize = function() {
		line2.resize();
	}
	
})
