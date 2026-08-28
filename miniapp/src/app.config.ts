export default defineAppConfig({
  pages: [
    'pages/explore/index',
    'pages/conversations/index',
    'pages/stats/index',
    'pages/profile/index',
    'pages/login/index',
    'pages/conversation-detail/index',
    'pages/configs/index',
    'pages/redeem/index',
    'pages/pricing/index',
    'pages/market/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F0F2F5',
    navigationBarTitleText: 'dstoolkit',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F0F2F5',
    backgroundColorTop: '#F0F2F5',
    backgroundColorBottom: '#F0F2F5'
  },
  tabBar: {
    color: '#86909C',
    selectedColor: '#165DFF',
    backgroundColor: '#F0F2F5',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/explore/index',
        text: '探索',
        iconPath: 'assets/tabbar/explore.svg',
        selectedIconPath: 'assets/tabbar/explore-selected.svg'
      },
      {
        pagePath: 'pages/conversations/index',
        text: '对话',
        iconPath: 'assets/tabbar/chat.svg',
        selectedIconPath: 'assets/tabbar/chat-selected.svg'
      },
      {
        pagePath: 'pages/stats/index',
        text: '统计',
        iconPath: 'assets/tabbar/stats.svg',
        selectedIconPath: 'assets/tabbar/stats-selected.svg'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tabbar/user.svg',
        selectedIconPath: 'assets/tabbar/user-selected.svg'
      }
    ]
  }
})
