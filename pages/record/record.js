const autoSync = require('../../utils/autoSync');

Page({
  data: {
    players: [],
    playerNames: [],
    player1Index: -1,
    player2Index: -1,
    player1Name: '',
    player2Name: '',
    player1Score: 0,
    player2Score: 0,
    canSubmit: false,
    loading: false,
    submitting: false
  },

  onLoad() {
    this.loadPlayersFromLocal();
  },

  onShow() {
    this.loadPlayersFromLocal();
  },

  // 从本地加载选手列表
  loadPlayersFromLocal() {
    const players = wx.getStorageSync('players') || [];
    const playerNames = players.map(player => player.name);
    
    this.setData({ 
      players,
      playerNames
    });
  },

  // 选择选手A
  onPlayer1Change(e) {
    const index = e.detail.value;
    const player = this.data.players[index];
    
    this.setData({
      player1Index: index,
      player1Name: player ? player.name : ''
    }, () => {
      this.checkCanSubmit();
    });
  },

  // 选择选手B
  onPlayer2Change(e) {
    const index = e.detail.value;
    const player = this.data.players[index];
    
    this.setData({
      player2Index: index,
      player2Name: player ? player.name : ''
    }, () => {
      this.checkCanSubmit();
    });
  },

  // 输入分数
  onScoreInput(e) {
    const { player } = e.currentTarget.dataset;
    const score = Math.max(0, parseInt(e.detail.value) || 0);
    
    if (player === '1') {
      this.setData({ player1Score: score });
    } else if (player === '2') {
      this.setData({ player2Score: score });
    }
    
    this.checkCanSubmit();
  },

  // 检查是否可以提交
  checkCanSubmit() {
    const { player1Name, player2Name, player1Score, player2Score } = this.data;
    
    const canSubmit = player1Name && 
                     player2Name && 
                     player1Name !== player2Name &&
                     (player1Score > 0 || player2Score > 0);
    
    this.setData({ canSubmit });
  },

  // 提交比分（直接操作远程）
  async submitScore() {
    if (!this.data.canSubmit || this.data.submitting) {
      wx.showToast({
        title: '请检查选手和分数',
        icon: 'none'
      });
      return;
    }

    const { player1Name, player2Name, player1Score, player2Score } = this.data;

    try {
      this.setData({ submitting: true });

      // 确定获胜者
      const winner = player1Score > player2Score ? player1Name : 
                    player2Score > player1Score ? player2Name : null;

      // 创建比赛记录
      const gameRecord = {
        id: Date.now(),
        player1: {
          name: player1Name,
          score: player1Score
        },
        player2: {
          name: player2Name,
          score: player2Score
        },
        winner: winner,
        gameTime: new Date().toISOString(),
        createTime: new Date().toISOString()
      };

      // 直接添加到远程
      await autoSync.addGame(gameRecord);

      // 重置表单
      this.resetForm();
      
      this.setData({ submitting: false });

      wx.showToast({
        title: '比分提交成功',
        icon: 'success'
      });

      // 重新加载选手数据以获取最新统计
      this.loadPlayersFromLocal();

    } catch (error) {
      this.setData({ submitting: false });
      console.error('提交比分失败:', error);
      
      let errorMessage = '提交失败，请重试';
      if (error.message) {
        if (error.message.includes('HTTP')) {
          errorMessage = '网络连接失败，请检查网络';
        } else if (error.message.includes('timeout')) {
          errorMessage = '请求超时，请重试';
        } else {
          errorMessage = `提交失败：${error.message}`;
        }
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 重置表单
  resetForm() {
    this.setData({
      player1Index: -1,
      player2Index: -1,
      player1Name: '',
      player2Name: '',
      player1Score: 0,
      player2Score: 0,
      canSubmit: false
    });
  },

  // 跳转到选手页面
  goToPlayers() {
    wx.switchTab({
      url: '/pages/players/players'
    });
  }
}); 