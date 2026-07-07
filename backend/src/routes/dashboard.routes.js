const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/stats', async (req, res, next) => {
  try {
    const userProjectFilter = {};
    if (req.user.role !== 'ADMIN') {
      const permissions = await prisma.userProjectPermission.findMany({
        where: { userId: req.user.id, canView: true },
        select: { projectId: true },
      });
      const allowedIds = permissions.map(p => p.projectId);
      if (allowedIds.length === 0) {
        return res.json({
          summary: { projects: 0, sites: 0, openTickets: 0, resolvedTickets: 0, orphanComments: 0, avgResolutionHours: null },
          statusChart: [],
          priorityChart: [],
          projectChart: [],
          trendData: [],
          assigneeData: [],
          recentTickets: [],
        });
      }
      userProjectFilter.projectId = { in: allowedIds };
    }

    const projectsCount = await prisma.project.count({
      where: { isActive: true, ...(userProjectFilter.projectId ? { id: userProjectFilter.projectId } : {}) }
    });
    const sitesCount = await prisma.site.count({
      where: { isActive: true, ...(userProjectFilter.projectId ? { projectId: userProjectFilter.projectId } : {}) }
    });

    const ticketWhere = userProjectFilter.projectId
      ? { comment: { site: { projectId: userProjectFilter.projectId.in } } }
      : {};

    const openTicketsCount = await prisma.ticket.count({
      where: { ...ticketWhere, status: 'OPEN' }
    });

    // Fetch all resolved tickets once — used for count, avg resolution, and chart data
    const resolvedTicketsWithDates = await prisma.ticket.findMany({
      where: { ...ticketWhere, status: { in: ['RESOLVED', 'CLOSED'] } },
      select: { status: true, createdAt: true, resolvedAt: true }
    });
    const resolvedTicketsCount = resolvedTicketsWithDates.length;

    let avgResolutionHours = null;
    const resolvedWithDates = resolvedTicketsWithDates.filter(t => t.resolvedAt);
    if (resolvedWithDates.length > 0) {
      const totalHours = resolvedWithDates.reduce((acc, t) => {
        const diffMs = t.resolvedAt.getTime() - t.createdAt.getTime();
        return acc + Math.max(0, diffMs / (1000 * 60 * 60));
      }, 0);
      avgResolutionHours = Math.round((totalHours / resolvedWithDates.length) * 10) / 10;
    }

    // Tickets grouped by status
    const ticketsByStatus = await prisma.ticket.groupBy({
      by: ['status'],
      where: ticketWhere,
      _count: { id: true }
    });
    const statusMap = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
    ticketsByStatus.forEach(item => { statusMap[item.status] = item._count.id; });
    const statusChart = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Tickets grouped by priority
    const ticketsByPriority = await prisma.ticket.groupBy({
      by: ['priority'],
      where: ticketWhere,
      _count: { id: true }
    });
    const priorityMap = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    ticketsByPriority.forEach(item => { priorityMap[item.priority] = item._count.id; });
    const priorityChart = Object.entries(priorityMap).map(([name, value]) => ({ name, value }));

    // Tickets grouped by project
    const projectWhere = userProjectFilter.projectId
      ? { site: { projectId: { in: userProjectFilter.projectId.in } } }
      : {};
    const commentsWithTicket = await prisma.comment.findMany({
      where: { ...projectWhere, ticket: { isNot: null } },
      select: {
        site: { select: { project: { select: { id: true, name: true } } } }
      }
    });
    const projectTicketMap = {};
    commentsWithTicket.forEach(c => {
      const p = c.site.project;
      projectTicketMap[p.id] = projectTicketMap[p.id] || { id: p.id, name: p.name, value: 0 };
      projectTicketMap[p.id].value++;
    });
    const projectChart = Object.values(projectTicketMap).sort((a, b) => b.value - a.value);

    // Trend: tickets created per day over last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ticketsTrend = await prisma.ticket.findMany({
      where: { ...ticketWhere, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
    const trendMap = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trendMap[key] = 0;
    }
    ticketsTrend.forEach(t => {
      const key = t.createdAt.toISOString().slice(0, 10);
      if (trendMap[key] !== undefined) trendMap[key]++;
    });
    const trendData = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Orphan comments (comments without ticket)
    const orphanComments = await prisma.comment.count({
      where: { ...projectWhere, ticket: null }
    });

    // Tickets per assignee
    const ticketsByAssignee = await prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: { ...ticketWhere, assigneeId: { not: null } },
      _count: { id: true }
    });
    const assigneeIds = ticketsByAssignee.map(a => a.assigneeId);
    const users = assigneeIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true, avatar: true } })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const assigneeData = ticketsByAssignee.map(item => ({
      id: item.assigneeId,
      name: userMap[item.assigneeId]?.name || 'Desconocido',
      avatar: userMap[item.assigneeId]?.avatar || null,
      openCount: item._count.id,
    })).sort((a, b) => b.openCount - a.openCount);

    // Recent activity (5 most recent tickets)
    const recentTickets = await prisma.ticket.findMany({
      where: ticketWhere,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        comment: {
          include: {
            site: {
              include: { project: true }
            }
          }
        },
        assignee: { select: { name: true, avatar: true } }
      }
    });

    res.json({
      summary: {
        projects: projectsCount,
        sites: sitesCount,
        openTickets: openTicketsCount,
        resolvedTickets: resolvedTicketsCount,
        orphanComments,
        avgResolutionHours,
      },
      statusChart,
      priorityChart,
      projectChart,
      trendData,
      assigneeData,
      recentTickets,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
