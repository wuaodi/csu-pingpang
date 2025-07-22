Page({
  data: {
    currentTab: 'ranking',
    userRankings: [],
    gameHistory: [],
    userOpenid: ''
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  // 加载数据
  loadData() {
    wx.showLoading({
      title: '加载中...'
    });

    Promise.all([
      this.loadUserRankings(),
      this.loadGameHistory(),
      this.getCurrentUserOpenid()
    ]).then(() => {
      wx.hideLoading();
    }).catch(err => {
      wx.hideLoading();
      console.error('加载数据失败', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  // 获取当前用户openid
  getCurrentUserOpenid() {
    return new Promise((resolve) => {
      const db = wx.cloud.database();
      db.collection('users').where({
        openid: '{openid}'
      }).get().then(res => {
        if (res.data.length > 0) {
          this.setData({
            userOpenid: res.data[0]._openid
          });
        }
        resolve();
      }).catch(err => {
        console.error('获取用户openid失败', err);
        resolve();
      });
    });
  },

  // 加载用户排行榜
  loadUserRankings() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      
      db.collection('users').get().then(res => {
        // 计算胜率并排序
        const users = res.data.map(user => {
          const totalGames = user.totalGames || 0;
          const wins = user.wins || 0;
          const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
          
          return {
            ...user,
            winRate: winRate
          };
        });

        // 按胜率排序，胜率相同则按总场次排序
        users.sort((a, b) => {
          if (a.winRate !== b.winRate) {
            return b.winRate - a.winRate;
          }
          return (b.totalGames || 0) - (a.totalGames || 0);
        });

        this.setData({ userRankings: users });
        resolve();
      }).catch(err => {
        console.error('加载排行榜失败', err);
        reject(err);
      });
    });
  },

  // 加载比赛记录
  loadGameHistory() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      
      db.collection('games')
        .orderBy('gameTime', 'desc')
        .limit(50)
        .get()
        .then(res => {
          const games = res.data.map(game => {
            // 格式化时间
            const gameTime = new Date(game.gameTime);
            const timeText = this.formatTime(gameTime);
            
            // 判断当前用户是否胜利
            const isCurrentUserWin = game.winner === '{openid}';
            
            return {
              ...game,
              timeText: timeText,
              isCurrentUserWin: isCurrentUserWin
            };
          });

          this.setData({ gameHistory: games });
          resolve();
        })
        .catch(err => {
          console.error('加载比赛记录失败', err);
          reject(err);
        });
    });
  },

  // 格式化时间
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      // 显示具体日期
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = date.getHours();
      const minute = date.getMinutes();
      
      return `${month}月${day}日 ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  },

  // 刷新数据
  refreshData() {
    this.loadData();
    
    wx.showToast({
      title: '刷新完成',
      icon: 'success',
      duration: 1000
    });
  }
}); 