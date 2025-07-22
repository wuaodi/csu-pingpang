Page({
  data: {
    userInfo: null,
    stats: null
  },

  onLoad() {
    // 检查用户信息
    this.checkUserInfo();
  },

  onShow() {
    // 每次显示页面时更新统计数据
    if (this.data.userInfo) {
      this.loadUserStats();
    }
  },

  // 检查用户信息
  checkUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
      this.loadUserStats();
    }
  },

  // 获取用户信息
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于显示用户头像和昵称',
      success: (res) => {
        const userInfo = res.userInfo;
        this.setData({ userInfo });
        
        // 保存用户信息到本地存储
        wx.setStorageSync('userInfo', userInfo);
        
        // 保存用户信息到云数据库
        this.saveUserToCloud(userInfo);
        
        // 加载统计数据
        this.loadUserStats();
        
        wx.showToast({
          title: '授权成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        wx.showToast({
          title: '授权失败',
          icon: 'none'
        });
      }
    });
  },

  // 保存用户信息到云数据库
  saveUserToCloud(userInfo) {
    const db = wx.cloud.database();
    
    // 检查用户是否已存在
    db.collection('users').where({
      openid: '{openid}'  // 云函数会自动替换为用户的openid
    }).get().then(res => {
      if (res.data.length === 0) {
        // 新用户，添加到数据库
        db.collection('users').add({
          data: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
            createTime: new Date(),
            totalGames: 0,
            wins: 0,
            losses: 0
          }
        }).then(res => {
          console.log('用户信息保存成功', res);
        }).catch(err => {
          console.error('用户信息保存失败', err);
        });
      } else {
        // 更新现有用户信息
        const userId = res.data[0]._id;
        db.collection('users').doc(userId).update({
          data: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl
          }
        }).then(res => {
          console.log('用户信息更新成功', res);
        }).catch(err => {
          console.error('用户信息更新失败', err);
        });
      }
    }).catch(err => {
      console.error('查询用户信息失败', err);
    });
  },

  // 加载用户统计数据
  loadUserStats() {
    const db = wx.cloud.database();
    
    // 获取用户统计数据
    db.collection('users').where({
      openid: '{openid}'
    }).get().then(res => {
      if (res.data.length > 0) {
        const userData = res.data[0];
        const winRate = userData.totalGames > 0 ? 
          Math.round((userData.wins / userData.totalGames) * 100) : 0;
        
        this.setData({
          stats: {
            totalGames: userData.totalGames || 0,
            wins: userData.wins || 0,
            losses: userData.losses || 0,
            winRate: winRate
          }
        });
      }
    }).catch(err => {
      console.error('加载统计数据失败', err);
    });
  }
}); 