import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const logDeployment = mutation({
  args: {
    environment: v.string(),
    deployedBy: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    commitMessage: v.optional(v.string()),
    branch: v.optional(v.string()),
    deploymentType: v.string(),
    status: v.string(),
    schemaVersion: v.optional(v.string()),
    functionCount: v.optional(v.number()),
    duration: v.optional(v.number()),
    error: v.optional(v.string()),
    metadata: v.optional(v.object({
      buildId: v.optional(v.string()),
      vercelDeploymentId: v.optional(v.string()),
      convexVersion: v.optional(v.string()),
      nodeVersion: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const deploymentId = await ctx.db.insert("deployments", {
      ...args,
      deployedAt: Date.now(),
    });
    
    return deploymentId;
  },
});

export const updateDeploymentStatus = mutation({
  args: {
    deploymentId: v.id("deployments"),
    status: v.string(),
    duration: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { deploymentId, ...updates } = args;
    
    await ctx.db.patch(deploymentId, updates);
    
    return { success: true };
  },
});

export const getRecentDeployments = query({
  args: {
    environment: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    let deploymentsQuery = ctx.db
      .query("deployments")
      .withIndex("by_environment");
    
    if (args.environment) {
      deploymentsQuery = deploymentsQuery
        .filter((q) => q.eq(q.field("environment"), args.environment));
    }
    
    const deployments = await deploymentsQuery
      .order("desc")
      .take(limit);
    
    return deployments;
  },
});

export const getDeploymentsByBranch = query({
  args: {
    branch: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    const deployments = await ctx.db
      .query("deployments")
      .withIndex("by_branch")
      .filter((q) => q.eq(q.field("branch"), args.branch))
      .order("desc")
      .take(limit);
    
    return deployments;
  },
});

export const getDeploymentStats = query({
  args: {
    environment: v.optional(v.string()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    let deploymentsQuery = ctx.db
      .query("deployments")
      .withIndex("by_environment");
    
    if (args.environment) {
      deploymentsQuery = deploymentsQuery
        .filter((q) => q.eq(q.field("environment"), args.environment));
    }
    
    const deployments = await deploymentsQuery
      .filter((q) => q.gte(q.field("deployedAt"), since))
      .collect();
    
    // Calculate statistics
    const total = deployments.length;
    const successful = deployments.filter(d => d.status === "success").length;
    const failed = deployments.filter(d => d.status === "failed").length;
    const avgDuration = deployments
      .filter(d => d.duration)
      .reduce((sum, d) => sum + (d.duration || 0), 0) / 
      (deployments.filter(d => d.duration).length || 1);
    
    // Group by day
    const byDay: Record<string, number> = {};
    deployments.forEach(d => {
      const day = new Date(d.deployedAt).toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });
    
    // Most active deployers
    const deployers: Record<string, number> = {};
    deployments.forEach(d => {
      if (d.deployedBy) {
        deployers[d.deployedBy] = (deployers[d.deployedBy] || 0) + 1;
      }
    });
    
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgDuration,
      byDay,
      topDeployers: Object.entries(deployers)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
    };
  },
});

export const getLatestDeployment = query({
  args: {
    environment: v.string(),
  },
  handler: async (ctx, args) => {
    const deployment = await ctx.db
      .query("deployments")
      .withIndex("by_environment")
      .filter((q) => q.eq(q.field("environment"), args.environment))
      .order("desc")
      .first();
    
    return deployment;
  },
});