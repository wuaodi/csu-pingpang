Page({
  data: {
    userInfo: null,
    allUsers: [],
    selectedOpponent: null,
    player1Score: 0,  // 当前用户得分
    player2Score: 0   // 对手得分
  },

  onLoad() {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.redirectTo({
        url: '/pages/index/index'
      });
      return;
    }
    
    this.setData({ userInfo });
    this.loadAllUsers();
  },

  // 加载所有用户
  loadAllUsers() {
    const db = wx.cloud.database();
    const currentUserOpenId = '{openid}';
    
    db.collection('users').get().then(res => {
      // 过滤掉当前用户
      const allUsers = res.data.filter(user => {
        return user._openid !== currentUserOpenId;
      });
      
      this.setData({ allUsers });
    }).catch(err => {
      console.error('加载用户列表失败', err);
      wx.showToast({
        title: '加载用户列表失败',
        icon: 'none'
      });
    });
  },

  // 选择对手
  selectOpponent(e) {
    const opponent = e.currentTarget.dataset.opponent;
    this.setData({
      selectedOpponent: opponent,
      player1Score: 0,
      player2Score: 0
    });
  },

  // 修改分数
  changeScore(e) {
    const { player, action } = e.currentTarget.dataset;
    const scoreKey = player === 'player1' ? 'player1Score' : 'player2Score';
    let currentScore = this.data[scoreKey];
    
    if (action === 'plus') {
      currentScore++;
    } else if (action === 'minus' && currentScore > 0) {
      currentScore--;
    }
    
    this.setData({
      [scoreKey]: currentScore
    });
  },

  // 快速设置比分
  setQuickScore(e) {
    const { score1, score2 } = e.currentTarget.dataset;
    this.setData({
      player1Score: parseInt(score1),
      player2Score: parseInt(score2)
    });
  },

  // 提交比分
  submitScore() {
    const { userInfo, selectedOpponent, player1Score, player2Score } = this.data;
    
    if (!selectedOpponent) {
      wx.showToast({
        title: '请选择对手',
        icon: 'none'
      });
      return;
    }

    if (player1Score === 0 && player2Score === 0) {
      wx.showToast({
        title: '请设置比分',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...'
    });

    const db = wx.cloud.database();
    const isWin = player1Score > player2Score;
    
    // 保存比赛记录
    const gameData = {
      player1: {
        openid: '{openid}',
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        score: player1Score
      },
      player2: {
        openid: selectedOpponent._openid,
        nickName: selectedOpponent.nickName,
        avatarUrl: selectedOpponent.avatarUrl,
        score: player2Score
      },
      winner: isWin ? '{openid}' : selectedOpponent._openid,
      gameTime: new Date(),
      createTime: new Date()
    };

    // 同时更新用户统计数据
    const updatePromises = [];
    
    // 保存比赛记录
    updatePromises.push(
      db.collection('games').add({
        data: gameData
      })
    );

    // 更新当前用户统计
    updatePromises.push(
      db.collection('users').where({
        openid: '{openid}'
      }).get().then(res => {
        if (res.data.length > 0) {
          const userData = res.data[0];
          const newStats = {
            totalGames: (userData.totalGames || 0) + 1,
            wins: userData.wins + (isWin ? 1 : 0),
            losses: userData.losses + (isWin ? 0 : 1)
          };
          
          return db.collection('users').doc(userData._id).update({
            data: newStats
          });
        }
      })
    );

    // 更新对手统计
    updatePromises.push(
      db.collection('users').doc(selectedOpponent._id).update({
        data: {
          totalGames: (selectedOpponent.totalGames || 0) + 1,
          wins: selectedOpponent.wins + (isWin ? 0 : 1),
          losses: selectedOpponent.losses + (isWin ? 1 : 0)
        }
      })
    );

    Promise.all(updatePromises).then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '保存成功!',
        icon: 'success'
      });
      
      // 重置表单
      this.setData({
        selectedOpponent: null,
        player1Score: 0,
        player2Score: 0
      });
      
      // 延迟跳转到榜单页面
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/leaderboard/leaderboard'
        });
      }, 1500);
      
    }).catch(err => {
      wx.hideLoading();
      console.error('保存失败', err);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    });
  }
}); 