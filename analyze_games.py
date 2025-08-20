#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSU乒乓球比赛数据分析脚本
分析两两交手胜率并进行可视化
"""

import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib import font_manager
from collections import defaultdict
import warnings
import networkx as nx
from matplotlib.patches import FancyBboxPatch

# 忽略警告
warnings.filterwarnings('ignore')

# 设置中文字体
def setup_chinese_font():
    """设置中文字体"""
    # 尝试多种中文字体
    chinese_fonts = [
        'SimHei',           # Windows 黑体
        'Microsoft YaHei',  # 微软雅黑
        'WenQuanYi Micro Hei', # 文泉驿微米黑
        'Noto Sans CJK SC',    # Google Noto字体
        'Source Han Sans SC',   # 思源黑体
        'DejaVu Sans'          # 备选字体
    ]
    
    # 获取系统可用字体
    available_fonts = [f.name for f in font_manager.fontManager.ttflist]
    
    # 寻找可用的中文字体
    for font in chinese_fonts:
        if font in available_fonts:
            plt.rcParams['font.sans-serif'] = [font]
            print(f"使用字体: {font}")
            break
    else:
        # 如果没有找到中文字体，使用默认字体并提醒用户
        print("警告: 未找到合适的中文字体，可能无法正确显示中文")
        print("建议安装中文字体包: sudo apt-get install fonts-wqy-microhei")
        plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
    
    plt.rcParams['axes.unicode_minus'] = False

# 设置中文字体
setup_chinese_font()

def load_game_data(file_path):
    """加载比赛数据"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"成功加载 {len(data)} 场比赛记录")
        return data
    except Exception as e:
        print(f"加载数据失败: {e}")
        return []

def analyze_head_to_head(games_data):
    """分析两两交手记录"""
    # 存储交手记录
    head_to_head = defaultdict(lambda: defaultdict(int))
    
    # 获取所有选手名单
    players = set()
    
    for game in games_data:
        player1 = game['player1']['name']
        player2 = game['player2']['name']
        winner = game['winner']
        
        players.add(player1)
        players.add(player2)
        
        # 记录交手结果
        if winner == player1:
            head_to_head[player1][player2] += 1
        else:
            head_to_head[player2][player1] += 1
    
    players = sorted(list(players))
    print(f"共有 {len(players)} 名选手: {', '.join(players)}")
    
    return head_to_head, players

def calculate_win_rates(head_to_head, players):
    """计算胜率矩阵"""
    n = len(players)
    win_matrix = np.zeros((n, n))
    total_games_matrix = np.zeros((n, n))
    
    for i, player1 in enumerate(players):
        for j, player2 in enumerate(players):
            if i != j:
                wins = head_to_head[player1][player2]
                losses = head_to_head[player2][player1]
                total = wins + losses
                
                total_games_matrix[i][j] = total
                if total > 0:
                    win_matrix[i][j] = wins / total * 100
                else:
                    win_matrix[i][j] = np.nan
    
    return win_matrix, total_games_matrix

def create_network_visualization(head_to_head, players):
    """创建网络图可视化"""
    fig, ax = plt.subplots(1, 1, figsize=(15, 12))
    
    # 创建网络图
    G = nx.DiGraph()
    
    # 添加节点（选手）
    for player in players:
        G.add_node(player)
    
    # 添加边（交手关系）
    for player1 in players:
        for player2 in players:
            if player1 != player2:
                wins = head_to_head[player1][player2]
                losses = head_to_head[player2][player1]
                total = wins + losses
                
                if total > 0:
                    win_rate = wins / total
                    # 只添加胜率超过50%的边，避免图过于复杂
                    if win_rate > 0.5:
                        G.add_edge(player1, player2, 
                                 weight=win_rate, 
                                 games=total,
                                 wins=wins)
    
    # 设置节点位置（圆形布局）
    pos = nx.circular_layout(G, scale=3)
    
    # 计算节点大小（基于总胜场数）
    node_sizes = []
    node_colors = []
    for player in players:
        total_wins = sum(head_to_head[player].values())
        total_losses = sum(head_to_head[opponent][player] for opponent in players)
        total_games = total_wins + total_losses
        win_rate = (total_wins / total_games) if total_games > 0 else 0
        
        node_sizes.append(max(1000, total_games * 50))  # 节点大小基于总比赛数
        node_colors.append(win_rate)  # 节点颜色基于总胜率
    
    # 绘制节点
    nodes = nx.draw_networkx_nodes(G, pos, 
                                 node_size=node_sizes,
                                 node_color=node_colors,
                                 cmap='RdYlGn',
                                 vmin=0, vmax=1,
                                 alpha=0.8,
                                 ax=ax)
    
    # 绘制边
    for edge in G.edges(data=True):
        player1, player2, data = edge
        weight = data['weight']
        games = data['games']
        wins = data['wins']
        
        # 边的宽度基于比赛场次
        edge_width = max(1, games / 3)
        
        # 边的颜色基于胜率
        edge_color = plt.cm.RdYlGn(weight)
        
        nx.draw_networkx_edges(G, pos,
                             edgelist=[(player1, player2)],
                             width=edge_width,
                             edge_color=[edge_color],
                             alpha=0.7,
                             arrowsize=20,
                             arrowstyle='->',
                             ax=ax)
        
        # 添加胜率标签
        x1, y1 = pos[player1]
        x2, y2 = pos[player2]
        label_x = (x1 + x2) / 2
        label_y = (y1 + y2) / 2
        
        ax.text(label_x, label_y, f'{weight*100:.0f}%',
                fontsize=9, fontweight='bold',
                ha='center', va='center',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', alpha=0.8))
    
    # 绘制节点标签
    nx.draw_networkx_labels(G, pos, 
                          font_size=12, 
                          font_weight='bold',
                          ax=ax)
    
    # 设置标题
    ax.set_title('CSU乒乓球选手交手关系网络图\n(箭头指向表示胜率>50%，节点大小表示比赛数量，颜色表示总胜率)', 
                fontsize=16, fontweight='bold', pad=20)
    
    # 添加颜色条
    cbar = plt.colorbar(nodes, ax=ax, shrink=0.8, aspect=20)
    cbar.set_label('总胜率', rotation=270, labelpad=20, fontsize=12)
    
    ax.axis('off')
    plt.tight_layout()
    return fig

def create_table_visualization(win_matrix, total_games_matrix, players):
    """创建小表格网格可视化"""
    n_players = len(players)
    # 计算网格布局 (尽量接近正方形)
    cols = int(np.ceil(np.sqrt(n_players)))
    rows = int(np.ceil(n_players / cols))
    
    fig, axes = plt.subplots(rows, cols, figsize=(4*cols, 3*rows))
    if rows == 1 and cols == 1:
        axes = [axes]
    elif rows == 1 or cols == 1:
        axes = axes.flatten()
    else:
        axes = axes.flatten()
    
    # 为每个选手创建一个小表格
    for idx, player in enumerate(players):
        ax = axes[idx]
        
        # 准备表格数据
        table_data = []
        colors = []
        
        for opponent in players:
            if player != opponent:
                i = players.index(player)
                j = players.index(opponent)
                
                win_rate = win_matrix[i][j]
                total_games = int(total_games_matrix[i][j])
                
                if total_games > 0:
                    win_rate_str = f"{win_rate:.1f}%"
                    games_str = f"({total_games}场)"
                    
                    # 根据胜率设置颜色
                    if win_rate >= 70:
                        color = '#90EE90'  # 浅绿
                    elif win_rate >= 50:
                        color = '#FFFFE0'  # 浅黄
                    else:
                        color = '#FFB6C1'  # 浅红
                else:
                    win_rate_str = "未交手"
                    games_str = ""
                    color = '#F5F5F5'  # 浅灰
                
                table_data.append([opponent, win_rate_str, games_str])
                colors.append([color, color, color])
        
        # 创建表格
        if table_data:
            table = ax.table(cellText=table_data,
                           colLabels=['对手', '胜率', '场次'],
                           cellLoc='center',
                           loc='center',
                           cellColours=colors)
            
            # 美化表格
            table.auto_set_font_size(False)
            table.set_fontsize(9)
            table.scale(1, 1.5)
            
            # 设置表头样式
            for i in range(3):
                table[(0, i)].set_facecolor('#4CAF50')
                table[(0, i)].set_text_props(weight='bold', color='white')
            
            # 设置表格边框
            for key, cell in table.get_celld().items():
                cell.set_linewidth(1)
                cell.set_edgecolor('black')
        
        # 设置子图标题
        ax.set_title(f'{player} 的交手记录', fontsize=12, fontweight='bold', pad=10)
        ax.axis('off')
    
    # 隐藏多余的子图
    for idx in range(n_players, len(axes)):
        axes[idx].axis('off')
    
    # 添加总标题
    fig.suptitle('CSU乒乓球选手交手记录表格', fontsize=16, fontweight='bold', y=0.98)
    
    # 添加图例说明
    legend_elements = [
        plt.Rectangle((0, 0), 1, 1, facecolor='#90EE90', edgecolor='black', label='胜率≥70%'),
        plt.Rectangle((0, 0), 1, 1, facecolor='#FFFFE0', edgecolor='black', label='胜率50-70%'),
        plt.Rectangle((0, 0), 1, 1, facecolor='#FFB6C1', edgecolor='black', label='胜率<50%'),
        plt.Rectangle((0, 0), 1, 1, facecolor='#F5F5F5', edgecolor='black', label='未交手')
    ]
    
    fig.legend(handles=legend_elements, loc='lower center', 
               bbox_to_anchor=(0.5, 0.01), ncol=4, fontsize=10)
    
    plt.tight_layout()
    plt.subplots_adjust(top=0.85, bottom=0.12, hspace=0.4, wspace=0.3)
    return fig

def create_visualization(win_matrix, total_games_matrix, players, head_to_head):
    """创建可视化图表 - 组合两种方法"""
    # 创建网络图
    fig1 = create_network_visualization(head_to_head, players)
    
    # 创建表格图
    fig2 = create_table_visualization(win_matrix, total_games_matrix, players)
    
    return fig1, fig2

def print_detailed_stats(head_to_head, players):
    """打印详细统计信息"""
    print("\n" + "="*60)
    print("详细交手记录统计")
    print("="*60)
    
    # 计算每个选手的总体统计
    player_stats = {}
    for player in players:
        total_wins = sum(head_to_head[player].values())
        total_losses = sum(head_to_head[opponent][player] for opponent in players)
        total_games = total_wins + total_losses
        win_rate = (total_wins / total_games * 100) if total_games > 0 else 0
        
        player_stats[player] = {
            'wins': total_wins,
            'losses': total_losses,
            'total': total_games,
            'win_rate': win_rate
        }
    
    # 按胜率排序
    sorted_players = sorted(player_stats.items(), key=lambda x: x[1]['win_rate'], reverse=True)
    
    print("\n选手总体战绩排名:")
    print("-" * 60)
    for rank, (player, stats) in enumerate(sorted_players, 1):
        print(f"{rank:2d}. {player:10s} | "
              f"胜: {stats['wins']:3d} | "
              f"负: {stats['losses']:3d} | "
              f"总: {stats['total']:3d} | "
              f"胜率: {stats['win_rate']:5.1f}%")
    
    print("\n两两交手详细记录:")
    print("-" * 60)
    for i, player1 in enumerate(players):
        for j, player2 in enumerate(players):
            if i < j:  # 避免重复显示
                wins1 = head_to_head[player1][player2]
                wins2 = head_to_head[player2][player1]
                total = wins1 + wins2
                
                if total > 0:
                    print(f"{player1} vs {player2}: "
                          f"{wins1}-{wins2} "
                          f"(总计{total}场)")

def main():
    """主函数"""
    print("CSU乒乓球比赛数据分析")
    print("="*40)
    
    # 加载数据
    file_path = "data/csu-pingpang-games.json"
    games_data = load_game_data(file_path)
    
    if not games_data:
        print("没有数据可分析!")
        return
    
    # 分析交手记录
    head_to_head, players = analyze_head_to_head(games_data)
    
    # 计算胜率矩阵
    win_matrix, total_games_matrix = calculate_win_rates(head_to_head, players)
    
    # 创建可视化
    fig1, fig2 = create_visualization(win_matrix, total_games_matrix, players, head_to_head)
    
    # 保存图表
    fig1.savefig('csu_pingpang_network.png', dpi=300, bbox_inches='tight')
    fig2.savefig('csu_pingpang_tables.png', dpi=300, bbox_inches='tight')
    print(f"\n可视化图表已保存为:")
    print(f"  - 网络关系图: csu_pingpang_network.png")
    print(f"  - 表格分析图: csu_pingpang_tables.png")
    
    # 显示图表
    plt.show()
    
    # 打印详细统计
    print_detailed_stats(head_to_head, players)

if __name__ == "__main__":
    main()
