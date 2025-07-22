App({
  globalData: {
    userInfo: null,
    env: 'your-cloud-env-id' // 替换为你的云环境ID
  },
  onLaunch() {
    wx.cloud.init({ env: this.globalData.env })
  }
})