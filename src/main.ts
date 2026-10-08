import { createApp } from 'vue'

import App from './App.vue'
import { registerFlowNodes } from './graph/nodes'
import './styles/global.css'

// 六类节点 shape 必须先于图实例创建完成注册
registerFlowNodes()

createApp(App).mount('#app')
