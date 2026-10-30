layui.use(['echarts'], function() {
	let echarts = layui.echarts;
	var column2 = echarts.init(document.getElementById('column2'),null, {
		width: 600,
		height: 400
	});

	var data = [1000, 600, 500, 300];
	option = {
		backgroundColor: '#ffffff',
		title: {
			text: 'ETC交易成功率',
			left: 'center',
			top: 2,
			fontSize: 20
		},
		color: ['#fed46b','#2194ff', ],
		tooltip: {
			trigger: 'axis',
			axisPointer: { // 坐标轴指示器，坐标轴触发有效
				type: 'shadow' // 默认为直线，可选为：'line' | 'shadow'
			}
		},
		grid: {
			left: '3%',
			right: '4%',
			bottom: '10%',
			containLabel: true
		},
		legend: {
			left: 'center',
			bottom: '2%',
			data: ['去年', '今年', ]
		},
		xAxis: [{
			type: 'category',
			data: ['09-22', '09-22', '09-22', '09-22', '09-22', '09-22', '09-22'],
			axisTick: {
				alignWithLabel: true
			}
		}],
		yAxis: [{
			type: 'value'
		}],
		barMaxWidth: '30',
		label:{
			show:true,
			position:'top',
			formatter:function(params){
				return params.value+'%'
			}
		},
		series: [
	
			{
				name: '去年',
				type: 'bar',
				data: [90, 52, 90, 80, 90, 70, 90]
			},
			{
				name: '今年',
				type: 'bar',
				data: [10, 52, 90, 70, 90, 70, 90]
			},
		]
	};
	column2.setOption(option);

	window.onresize = function() {
		column2.resize();
	}
	
})
