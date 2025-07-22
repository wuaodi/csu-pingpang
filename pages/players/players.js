const autoSync = require('../../utils/autoSync');

Page({
  data: {
    players: [],
    showModal: false,
    newPlayerName: ''
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
    
    // 计算胜率
    const playersWithStats = players.map(player => {
      const totalGames = player.totalGames || 0;
      const wins = player.wins || 0;
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
      
      return {
        ...player,
        winRate
      };
    });

    this.setData({ players: playersWithStats });
  },

  // 显示添加选手弹窗
  showAddModal() {
    this.setData({ 
      showModal: true,
      newPlayerName: ''
    });
  },

  // 隐藏添加选手弹窗
  hideAddModal() {
    this.setData({ 
      showModal: false,
      newPlayerName: ''
    });
  },

  // 输入选手姓名
  onPlayerNameInput(e) {
    this.setData({
      newPlayerName: e.detail.value.trim()
    });
  },

  // 添加选手
  addPlayer() {
    const { newPlayerName, players } = this.data;
    
    if (!newPlayerName) {
      wx.showToast({
        title: '请输入选手姓名',
        icon: 'none'
      });
      return;
    }

    // 检查重名
    const existingPlayer = players.find(p => p.name === newPlayerName);
    if (existingPlayer) {
      wx.showToast({
        title: '选手已存在',
        icon: 'none'
      });
      return;
    }

    // 添加新选手
    const newPlayer = {
      id: Date.now(),
      name: newPlayerName,
      totalGames: 0,
      wins: 0,
      losses: 0,
      createTime: new Date().toISOString()
    };

    const updatedPlayers = [...players, newPlayer];
    wx.setStorageSync('players', updatedPlayers);

    this.setData({
      players: updatedPlayers,
      showModal: false,
      newPlayerName: ''
    });

    // 自动同步到云端
    this.syncToCloud();

    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },

  // 删除选手
  deletePlayer(e) {
    const playerId = e.currentTarget.dataset.id;
    const player = this.data.players.find(p => p.id === playerId);
    
    if (!player) return;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选手"${player.name}"吗？`,
      confirmText: '删除',
      confirmColor: '#ff4444',
      success: (res) => {
        if (res.confirm) {
          const updatedPlayers = this.data.players.filter(p => p.id !== playerId);
          wx.setStorageSync('players', updatedPlayers);
          this.setData({ players: updatedPlayers });

          // 自动同步到云端
          this.syncToCloud();

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
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