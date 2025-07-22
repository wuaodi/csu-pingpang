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
    canSubmit: false
  },

  onLoad() {
    this.loadPlayers();
    this.autoSyncData();
  },

  onShow() {
    this.loadPlayers();
    this.autoSyncData();
  },

  // 加载选手列表
  loadPlayers() {
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

  // 提交比分
  submitScore() {
    const { players, player1Name, player2Name, player1Score, player2Score } = this.data;
    
    if (!this.data.canSubmit) {
      wx.showToast({
        title: '请检查选手和分数',
        icon: 'none'
      });
      return;
    }

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

    // 保存比赛记录
    const games = wx.getStorageSync('games') || [];
    games.unshift(gameRecord);
    wx.setStorageSync('games', games);

    // 更新选手统计
    this.updatePlayerStats(player1Name, player2Name, winner);

    // 重置表单
    this.resetForm();

    // 自动同步到云端
    this.syncToCloud();

    wx.showToast({
      title: '比分提交成功',
      icon: 'success'
    });
  },

  // 更新选手统计
  updatePlayerStats(player1Name, player2Name, winner) {
    const players = [...this.data.players];
    
    players.forEach(player => {
      if (player.name === player1Name || player.name === player2Name) {
        player.totalGames = (player.totalGames || 0) + 1;
        
        if (winner === player.name) {
          player.wins = (player.wins || 0) + 1;
        } else if (winner !== null) {
          player.losses = (player.losses || 0) + 1;
        }
      }
    });

    wx.setStorageSync('players', players);
    this.setData({ players });
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
  },

  // 自动同步数据到云端
  async syncToCloud() {
    try {
      await autoSync.fullSync();
    } catch (error) {
      // 静默处理错误
    }
  },

  // 页面进入时自动同步
  async autoSyncData() {
    try {
      const synced = await autoSync.smartSync();
      if (synced) {
        this.loadPlayers();
      }
    } catch (error) {
      // 静默处理错误
    }
  }
}); 