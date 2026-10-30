layui.use(['echarts'], function() {
	let echarts = layui.echarts;

	var line3 = echarts.init(document.getElementById('line3'),null, {
		width: 600,
		height: 400
	});

	const colorList = ["#9E87FF", '#73DDFF', '#fe9a8b', '#F56948', '#9E87FF']

	option = {
		backgroundColor: '#fff',
		title: {
			text: "告警数",
			left: "18px",
			top: "0",			
			color: "#999",
			fontSize: 12,
			fontWeight: '400'			
		},
		color: ['#73A0FA', '#73DEB3', '#FFB761'],
		tooltip: {
			trigger: 'axis',
			axisPointer: {
				type: 'cross',
				crossStyle: {
					color: '#999'
				},
				lineStyle: {
					type: 'dashed'
				}
			}
		},
		grid: {
			left: '25',
			right: '25',
			bottom: '24',
			top: '75',
			containLabel: true
		},
		legend: {
			data: ['上周', '本周'],
			orient: 'horizontal',
			icon: "rect",
			show: true,
			left: 20,
			top: 25,
		},
		xAxis: {
			type: 'category',
			data: ['爱立信端局', '中兴端局', '爱立信HSS', '中兴HSS', '华为HSS', '华为智能网', '中兴VIMS'],
			splitLine: {
				show: false
			},
			axisTick: {
				show: false
			},
			axisLine: {
				show: false
			},
		},
		yAxis: {
			type: 'value',
			axisLabel: {
				color: '#999',				
				fontSize: 12				
			},
			splitLine: {
				show: true,
				lineStyle: {
					color: '#F3F4F4'
				}
			},
			axisTick: {
				show: false
			},
			axisLine: {
				show: false
			},
		},
		series: [{
				name: '上周',
				type: 'line',
				smooth: true,
				data: [1800, 1000, 2000, 1000, 500, 100, 1200]
			},
			{
				name: '本周',
				type: 'line',
				smooth: true,
				data: [1700, 999, 1100, 899, 199, 99, 1000]
			}
		]
	};

	line3.setOption(option);

	window.onresize = function() {
		line3.resize();
	}
	
})
