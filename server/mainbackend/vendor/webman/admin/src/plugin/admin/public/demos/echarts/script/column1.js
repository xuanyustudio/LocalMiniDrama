layui.use(['echarts'], function() {
	let echarts = layui.echarts;
    var column1 = echarts.init(document.getElementById('column1'),null, {
        width: 600,
        height: 400
    });
option = {
    tooltip: {
        trigger: 'axis',
        axisPointer: { 
            type: 'shadow' ,
            color: '#fff',
            fontSize: '26'
        }
    },
    legend: {
        top:'5%',
        right:'10%',
        data: ['猕猴桃', '香蕉'],
        fontSize:12,
        color:'#808080',
        icon:'rect'
    },
    grid: {
        top:60,
        left:50,
        bottom:60,
        right:60
    },
    xAxis: [{
        type: 'category',
        axisTick:{
            show:false
        },
        axisLine:{
            show:false
        },
        axisLabel:{
            color:'#4D4D4D',
            fontSize:14,
            margin:21,
            fontWeight:'bold'
        },
        data: ['第一周', '第二周', '第三周', '第四周'],
    
    }],
    yAxis: [{
        name:'单位：万',
        nameTextStyle:{
            color:'#808080',
            fontSize:12,
            padding:[0, 0, 0, -5]
        },
        max: function(value) {
            if(value.max<5){
                return 5
            }else{
                return value.max
            }
        },
        type: 'value',
        axisLine:{
            show:false
        },
        axisLabel:{
            color:'#808080',
            fontSize:12,
            margin:5
        },
        splitLine:{
            show:false
        },
        axisTick:{
            show:false
        }
    }],
    series: [
        {
            name: '猕猴桃',
            type: 'bar',
            label:{
                show:true,
                position:'top',
                fontSize:14,
                color:'#3DC3F0',
                fontWeight:'bold'
            },
            barMaxWidth:60,           
            color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [{
                    offset: 0, color: '#3DC3F0' // 0% 处的颜色
                }, {
                    offset: 1, color: '#CCF2FF' // 100% 处的颜色
                }]
            },            
            data: [60, 110, 180, 100]
        }, 
        {
            name: '香蕉',
            type: 'bar',
                        label:{
                show:true,
                position:'top',
                fontSize:14,
                color:'#3D8BF0',
                fontWeight:'bold'
            },
            barMaxWidth:60,            
            color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [{
                    offset: 0, color: '#3D8BF0' // 0% 处的颜色
                }, {
                    offset: 1, color: '#CCE2FF' // 100% 处的颜色
                }]
            },            
            data: [90, 130, 170, 130]
        }
    ]
};

    column1.setOption(option);

    window.onresize = function() {
        column1.resize();
    }
    
})
