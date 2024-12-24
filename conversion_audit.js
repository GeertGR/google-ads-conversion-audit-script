/**
 * Google Ads Conversion Audit Script
 * Version: 1.0
 * Created: 2024
 * 
 * @description
 * This script performs a comprehensive audit of Google Ads conversion tracking across your account.
 * It checks for:
 * - Active conversion actions
 * - Conversion values
 * - Primary and secondary goals
 * - Conversion performance
 * - Missing configurations
 * 
 * The script generates a detailed HTML report that includes:
 * - Overview of all conversion actions
 * - Performance metrics for different time periods
 * - Best practices and recommendations
 * - Status indicators and improvement suggestions
 * 
 * @author Geert Groot
 * @copyright 2024 Geert Groot. All rights reserved.
 * @link https://www.linkedin.com/in/geertgroot/
 * 
 * For questions or custom implementations, feel free to connect on LinkedIn.
 */

var CONFIG = {
    // Email settings
    EMAIL: {
        ENABLED: true,
        RECIPIENT: "YOUR_EMAIL_HERE",
        SUBJECT_PREFIX: "Conversion Audit Report"
    },
    // Audit period settings
    AUDIT_PERIOD: {
        DAYS: 30,  // Default to last 30 days if no specific dates set
        START_DATE: null,  // Format: 'YYYY-MM-DD'
        END_DATE: null     // Format: 'YYYY-MM-DD'
    },
    GOALS: {
        PRIMARY_CONVERSION: null // Optional: specify a single primary conversion to focus on
    }
};

function main() {
    Logger.log('🚀 Starting conversion audit...');
    var startTime = new Date();
    
    try {
        Logger.log('🎯 Auditing conversions...');
        var conversionResults = auditConversions();
        Logger.log(`Found ${conversionResults.total} conversion actions`);
        Logger.log(`Active conversions: ${conversionResults.summary.activeConversions.length}`);
        
        Logger.log('📧 Generating and sending email report...');
        var emailBody = generateConversionReport(conversionResults);
        
        if (CONFIG.EMAIL.ENABLED) {
            sendEmail(emailBody);
        }
        
        var endTime = new Date();
        var duration = (endTime - startTime) / 1000;
        Logger.log(`✅ Conversion audit completed successfully in ${duration} seconds`);
    } catch (e) {
        Logger.log('❌ Error during audit: ' + e);
        Logger.log('Stack trace: ' + e.stack);
        sendErrorNotification(e);
    }
}

function auditConversions() {
    var results = {
        total: 0,
        issues: [],
        opportunities: [],
        summary: {
            activeConversions: [],
            noValueSet: [],
            noConversions30Days: [],
            lowConvRate: [],
            devicePerformance: {
                MOBILE: { conversions: 0, value: 0, clicks: 0 },
                DESKTOP: { conversions: 0, value: 0, clicks: 0 },
                TABLET: { conversions: 0, value: 0, clicks: 0 }
            },
            campaignPerformance: {}
        }
    };

    // First get all conversion actions
    var query = `
        SELECT 
            conversion_action.id,
            conversion_action.name,
            conversion_action.category,
            conversion_action.status,
            conversion_action.primary_for_goal,
            conversion_action.include_in_conversions_metric,
            conversion_action.counting_type,
            conversion_action.value_settings.default_value,
            conversion_action.attribution_model_settings.attribution_model,
            conversion_action.app_id,
            conversion_action.type
        FROM conversion_action
        WHERE conversion_action.status = 'ENABLED'`;

    Logger.log('Running conversion query...');
    var report = AdsApp.report(query);
    var rows = report.rows();

    while (rows.hasNext()) {
        var row = rows.next();
        var name = row['conversion_action.name'];
        var defaultValue = parseFloat(row['conversion_action.value_settings.default_value'] || '0');
        var primaryForGoal = row['conversion_action.primary_for_goal'];

        var conversionAction = {
            id: row['conversion_action.id'],
            name: name,
            status: row['conversion_action.status'],
            category: row['conversion_action.category'],
            countingType: row['conversion_action.counting_type'],
            defaultValue: defaultValue,
            hasValue: defaultValue > 0,
            includeInConversions: row['conversion_action.include_in_conversions_metric'] === 'true',
            isPrimary: String(primaryForGoal).toLowerCase() === 'true',
            attributionModel: row['conversion_action.attribution_model_settings.attribution_model'],
            type: row['conversion_action.type'],
            conversions: 0,
            value: 0,
            periodConversions: 0,
            periodValue: 0,
            clicks: 0,
            periodClicks: 0,
            conversionRate: 0,
            periodConversionRate: 0,
            costPerConversion: 0,
            periodCostPerConversion: 0,
            devicePerformance: {
                MOBILE: { conversions: 0, value: 0, clicks: 0 },
                DESKTOP: { conversions: 0, value: 0, clicks: 0 },
                TABLET: { conversions: 0, value: 0, clicks: 0 }
            },
            trends: {
                weeklyConversions: [],
                weeklyValue: []
            }
        };

        // Get device performance
        try {
            var deviceQuery = `
                SELECT 
                    segments.conversion_action_name,
                    segments.device,
                    metrics.all_conversions,
                    metrics.all_conversions_value
                FROM customer
                WHERE segments.conversion_action_name = '${name}'
                AND ${getDateRange()}`;
            
            var deviceReport = AdsApp.report(deviceQuery);
            var deviceRows = deviceReport.rows();
            
            while (deviceRows.hasNext()) {
                var deviceRow = deviceRows.next();
                var device = deviceRow['segments.device'];
                var conversions = parseFloat(deviceRow['metrics.all_conversions'] || '0');
                var value = parseFloat(deviceRow['metrics.all_conversions_value'] || '0');
                
                if (device in conversionAction.devicePerformance) {
                    conversionAction.devicePerformance[device] = {
                        conversions: conversions,
                        value: value
                    };
                    
                    // Update the summary totals
                    results.summary.devicePerformance[device].conversions += conversions;
                    results.summary.devicePerformance[device].value += value;
                }
            }
        } catch (e) {
            Logger.log(`Error getting device stats for conversion action ${name}: ${e}`);
        }

        // Get weekly trends
        try {
            var trendQuery = `
                SELECT 
                    segments.conversion_action_name,
                    segments.week,
                    metrics.all_conversions,
                    metrics.all_conversions_value
                FROM customer
                WHERE segments.conversion_action_name = '${name}'
                AND ${getDateRange()}
                ORDER BY segments.week`;
            
            var trendReport = AdsApp.report(trendQuery);
            var trendRows = trendReport.rows();
            
            while (trendRows.hasNext()) {
                var trendRow = trendRows.next();
                conversionAction.trends.weeklyConversions.push(parseFloat(trendRow['metrics.all_conversions'] || '0'));
                conversionAction.trends.weeklyValue.push(parseFloat(trendRow['metrics.all_conversions_value'] || '0'));
            }
        } catch (e) {
            Logger.log(`Error getting trend stats for conversion action ${name}: ${e}`);
        }

        // Get period stats
        try {
            var periodQuery = `
                SELECT 
                    segments.conversion_action_name,
                    metrics.all_conversions,
                    metrics.all_conversions_value
                FROM customer
                WHERE segments.conversion_action_name = '${name}'
                AND ${getDateRange()}`;
            
            var periodReport = AdsApp.report(periodQuery);
            var periodRows = periodReport.rows();
            
            while (periodRows.hasNext()) {
                var periodRow = periodRows.next();
                conversionAction.periodConversions = parseFloat(periodRow['metrics.all_conversions'] || '0');
                conversionAction.periodValue = parseFloat(periodRow['metrics.all_conversions_value'] || '0');
            }

            // Get campaign level stats for conversion rate and cost
            var campaignQuery = `
                SELECT
                    metrics.clicks,
                    metrics.cost_micros
                FROM campaign
                WHERE campaign.status = 'ENABLED'
                AND ${getDateRange()}`;

            var campaignReport = AdsApp.report(campaignQuery);
            var campaignRows = campaignReport.rows();
            
            var totalClicks = 0;
            var totalCost = 0;
            while (campaignRows.hasNext()) {
                var campaignRow = campaignRows.next();
                totalClicks += parseFloat(campaignRow['metrics.clicks'] || '0');
                totalCost += parseFloat(campaignRow['metrics.cost_micros'] || '0') / 1000000;
            }

            conversionAction.periodClicks = totalClicks;
            conversionAction.periodConversionRate = totalClicks > 0 ? 
                (conversionAction.periodConversions / totalClicks) * 100 : 0;
            conversionAction.periodCostPerConversion = conversionAction.periodConversions > 0 ? 
                totalCost / conversionAction.periodConversions : 0;
        } catch (e) {
            Logger.log(`Error getting period stats for conversion action ${name}: ${e}`);
        }

        // Get 30-day stats
        try {
            var thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            var today = new Date();
            
            var formattedThirtyDaysAgo = thirtyDaysAgo.toISOString().split('T')[0];
            var formattedToday = today.toISOString().split('T')[0];
            
            var thirtyDayQuery = `
                SELECT 
                    segments.conversion_action_name,
                    metrics.all_conversions,
                    metrics.all_conversions_value
                FROM customer
                WHERE segments.conversion_action_name = '${name}'
                AND segments.date BETWEEN '${formattedThirtyDaysAgo}' AND '${formattedToday}'`;
            
            var thirtyDayReport = AdsApp.report(thirtyDayQuery);
            var thirtyDayRows = thirtyDayReport.rows();
            
            while (thirtyDayRows.hasNext()) {
                var thirtyDayRow = thirtyDayRows.next();
                conversionAction.conversions = parseFloat(thirtyDayRow['metrics.all_conversions'] || '0');
                conversionAction.value = parseFloat(thirtyDayRow['metrics.all_conversions_value'] || '0');
            }

            // Get campaign level stats for conversion rate and cost
            var campaignThirtyDayQuery = `
                SELECT
                    metrics.clicks,
                    metrics.cost_micros
                FROM campaign
                WHERE campaign.status = 'ENABLED'
                AND segments.date BETWEEN '${formattedThirtyDaysAgo}' AND '${formattedToday}'`;

            var campaignThirtyDayReport = AdsApp.report(campaignThirtyDayQuery);
            var campaignThirtyDayRows = campaignThirtyDayReport.rows();
            
            var totalClicks = 0;
            var totalCost = 0;
            while (campaignThirtyDayRows.hasNext()) {
                var campaignRow = campaignThirtyDayRows.next();
                totalClicks += parseFloat(campaignRow['metrics.clicks'] || '0');
                totalCost += parseFloat(campaignRow['metrics.cost_micros'] || '0') / 1000000;
            }

            conversionAction.clicks = totalClicks;
            conversionAction.conversionRate = totalClicks > 0 ? 
                (conversionAction.conversions / totalClicks) * 100 : 0;
            conversionAction.costPerConversion = conversionAction.conversions > 0 ? 
                totalCost / conversionAction.conversions : 0;
        } catch (e) {
            Logger.log(`Error getting 30-day stats for conversion action ${name}: ${e}`);
        }

        // Get campaign level conversion data
        try {
            var campaignQuery = `
                SELECT 
                    campaign.name,
                    segments.conversion_action_name,
                    metrics.all_conversions,
                    metrics.all_conversions_value
                FROM campaign
                WHERE campaign.status = 'ENABLED'
                AND segments.conversion_action_name = '${name}'
                AND ${getDateRange()}
                ORDER BY metrics.all_conversions DESC`;
            
            var campaignReport = AdsApp.report(campaignQuery);
            var campaignRows = campaignReport.rows();
            
            while (campaignRows.hasNext()) {
                var campaignRow = campaignRows.next();
                var campaignName = campaignRow['campaign.name'];
                var conversions = parseFloat(campaignRow['metrics.all_conversions'] || '0');
                var value = parseFloat(campaignRow['metrics.all_conversions_value'] || '0');
                
                if (!(campaignName in results.summary.campaignPerformance)) {
                    results.summary.campaignPerformance[campaignName] = {
                        conversions: 0,
                        value: 0,
                        conversionActions: {}
                    };
                }
                
                results.summary.campaignPerformance[campaignName].conversions += conversions;
                results.summary.campaignPerformance[campaignName].value += value;
                
                results.summary.campaignPerformance[campaignName].conversionActions[name] = {
                    conversions: conversions,
                    value: value
                };
            }
        } catch (e) {
            Logger.log(`Error getting campaign stats for conversion action ${name}: ${e}`);
        }

        // Add to appropriate summary lists and check for issues
        results.summary.activeConversions.push(conversionAction);
        
        if (!conversionAction.hasValue) {
            results.summary.noValueSet.push(conversionAction);
            results.issues.push({
                type: 'no_value',
                severity: 'medium',
                conversion: name,
                message: 'No conversion value set'
            });
        }
        
        if (conversionAction.conversions === 0) {
            results.summary.noConversions30Days.push(conversionAction);
            results.issues.push({
                type: 'no_conversions',
                severity: 'high',
                conversion: name,
                message: 'No conversions in last 30 days'
            });
        }

        // Check for low conversion rate (below 1%)
        if (conversionAction.conversionRate < 1 && conversionAction.clicks > 100) {
            results.summary.lowConvRate.push(conversionAction);
            results.issues.push({
                type: 'low_conversion_rate',
                severity: 'high',
                conversion: name,
                message: `Low conversion rate (${conversionAction.conversionRate.toFixed(2)}%)`
            });
        }

        // Check for significant device performance differences
        var deviceConversions = Object.values(conversionAction.devicePerformance)
            .map(d => d.conversions)
            .filter(c => c > 0);
        if (deviceConversions.length > 1) {
            var maxConversions = Math.max(...deviceConversions);
            var minConversions = Math.min(...deviceConversions);
            if (maxConversions / minConversions > 3) {
                results.opportunities.push({
                    type: 'device_optimization',
                    severity: 'medium',
                    conversion: name,
                    message: 'Large performance difference between devices'
                });
            }
        }

        // Analyze conversion trends
        if (conversionAction.trends.weeklyConversions.length > 1) {
            var lastWeek = conversionAction.trends.weeklyConversions[conversionAction.trends.weeklyConversions.length - 1];
            var previousWeek = conversionAction.trends.weeklyConversions[conversionAction.trends.weeklyConversions.length - 2];
            if (lastWeek < previousWeek * 0.7) {
                results.issues.push({
                    type: 'declining_trend',
                    severity: 'high',
                    conversion: name,
                    message: 'Significant decrease in conversions last week'
                });
            }
        }

        results.total++;
    }

    return results;
}

function generateConversionReport(results) {
    const showPeriodComparison = CONFIG.AUDIT_PERIOD.DAYS !== 30;
    
    return `
        <html>
            <head>${getEmailStyles()}</head>
            <body>
                <div class="container">
                    <h1>🎯 Conversion Tracking Overview</h1>
                    
                    <div class="conversion-summary">
                        <h2>Active Conversion Actions</h2>
                        <table class="summary-table">
                            <tr>
                                <th>Conversion Action</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Goal Type</th>
                                <th>Attribution Model</th>
                                ${showPeriodComparison ? '<th>Period</th>' : ''}
                                <th>Conversions</th>
                                <th>Value</th>
                            </tr>
                            ${results.summary.activeConversions.map(conv => {
                                if (!showPeriodComparison) {
                                    return `
                                        <tr>
                                            <td>${conv.name}</td>
                                            <td>${conv.category}</td>
                                            <td class="good">Active</td>
                                            <td>${conv.isPrimary === true ? '🎯 Primary' : '⭐ Secondary'}</td>
                                            <td>${conv.attributionModel}</td>
                                            <td class="${conv.conversions > 0 ? 'good' : 'warning'}">${conv.conversions}</td>
                                            <td>${conv.value.toFixed(2)}</td>
                                        </tr>
                                    `;
                                }
                                
                                return `
                                    <tr>
                                        <td>${conv.name}</td>
                                        <td>${conv.category}</td>
                                        <td class="good">Active</td>
                                        <td>${conv.isPrimary === true ? '🎯 Primary' : '⭐ Secondary'}</td>
                                        <td>${conv.attributionModel}</td>
                                        <td class="period-indicator">Last 30 days</td>
                                        <td class="${conv.conversions > 0 ? 'good' : 'warning'}">${conv.conversions}</td>
                                        <td>${conv.value.toFixed(2)}</td>
                                    </tr>
                                    <tr class="period-row">
                                        <td>${conv.name}</td>
                                        <td>${conv.category}</td>
                                        <td class="good">Active</td>
                                        <td>${conv.isPrimary === true ? '🎯 Primary' : '⭐ Secondary'}</td>
                                        <td>${conv.attributionModel}</td>
                                        <td class="period-indicator">Selected Period</td>
                                        <td class="${conv.periodConversions > 0 ? 'good' : 'warning'}">${conv.periodConversions}</td>
                                        <td>${conv.periodValue.toFixed(2)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </table>
                        
                        <div class="device-performance">
                            <h3>Device Performance</h3>
                            <table class="summary-table">
                                <tr>
                                    <th>Device</th>
                                    <th>Conversions</th>
                                    <th>Value</th>
                                </tr>
                                ${Object.entries(results.summary.devicePerformance)
                                    .filter(([device, _]) => device !== 'UNSPECIFIED' && device !== 'UNKNOWN')
                                    .map(([device, stats]) => {
                                        return `
                                            <tr>
                                                <td>${device.charAt(0) + device.slice(1).toLowerCase()}</td>
                                                <td class="${stats.conversions > 0 ? 'good' : ''}">${stats.conversions}</td>
                                                <td>${stats.value.toFixed(2)}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                            </table>
                        </div>
                        
                        <div class="campaign-performance">
                            <h3>Campaign Performance</h3>
                            <table class="summary-table">
                                <tr>
                                    <th>Campaign</th>
                                    <th>Total Conversions</th>
                                    <th>Total Value</th>
                                    <th>Conversion Actions</th>
                                </tr>
                                ${Object.entries(results.summary.campaignPerformance)
                                    .sort(([, a], [, b]) => b.conversions - a.conversions)
                                    .map(([campaign, stats]) => {
                                        const conversionDetails = Object.entries(stats.conversionActions)
                                            .filter(([, convStats]) => convStats.conversions > 0)
                                            .map(([action, convStats]) => 
                                                `${action}: ${convStats.conversions} (${convStats.value.toFixed(2)})`
                                            ).join('<br>');
                                        
                                        return `
                                            <tr>
                                                <td>${campaign}</td>
                                                <td class="${stats.conversions > 0 ? 'good' : ''}">${stats.conversions}</td>
                                                <td>${stats.value.toFixed(2)}</td>
                                                <td class="conversion-details">${conversionDetails}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                            </table>
                        </div>
                        
                        <div class="conversion-totals">
                            <h3>Conversion Summary</h3>
                            <table class="summary-table">
                                <tr>
                                    <th></th>
                                    ${showPeriodComparison ? `
                                        <th>Last 30 Days</th>
                                        <th>Selected Period</th>
                                    ` : '<th>Total</th>'}
                                </tr>
                                <tr>
                                    <td>Total Conversions:</td>
                                    ${showPeriodComparison ? `
                                        <td>${results.summary.activeConversions.reduce((sum, conv) => sum + conv.conversions, 0)}</td>
                                        <td>${results.summary.activeConversions.reduce((sum, conv) => sum + conv.periodConversions, 0)}</td>
                                    ` : `<td>${results.summary.activeConversions.reduce((sum, conv) => sum + conv.conversions, 0)}</td>`}
                                </tr>
                                <tr>
                                    <td>Total Value:</td>
                                    ${showPeriodComparison ? `
                                        <td>${results.summary.activeConversions.reduce((sum, conv) => sum + conv.value, 0).toFixed(2)}</td>
                                        <td>${results.summary.activeConversions.reduce((sum, conv) => sum + conv.periodValue, 0).toFixed(2)}</td>
                                    ` : `<td>${results.summary.activeConversions.reduce((sum, conv) => sum + conv.value, 0).toFixed(2)}</td>`}
                                </tr>
                            </table>
                        </div>
                        
                        ${generateActionPlan(results)}
                    </div>
                </div>
            </body>
        </html>
    `;
}

function generateActionPlan(results) {
    const actionItems = [];
    
    // Get primary conversion actions
    let primaryConversions;
    if (CONFIG.GOALS.PRIMARY_CONVERSION) {
        // If specific primary conversion is set, only use that one
        primaryConversions = [CONFIG.GOALS.PRIMARY_CONVERSION];
    } else {
        // Otherwise, use all conversions marked as primary
        primaryConversions = results.summary.activeConversions
            .filter(conv => conv.isPrimary)
            .map(conv => conv.name);
    }
    
    if (primaryConversions.length === 0) {
        actionItems.push({
            priority: 'HIGH',
            type: 'No Primary Goals',
            action: 'Set up primary conversion goals',
            tip: 'Define which conversion actions are your main campaign objectives',
            affected: ['No primary conversion actions defined']
        });
    }

    // Check campaigns with no conversions
    const campaignsWithNoConversions = Object.entries(results.summary.campaignPerformance)
        .filter(([_, stats]) => stats.conversions === 0)
        .map(([name]) => name);
    
    if (campaignsWithNoConversions.length > 0) {
        actionItems.push({
            priority: 'HIGH',
            type: 'No Conversions',
            action: `Review ${campaignsWithNoConversions.length} campaign(s) with no conversions`,
            tip: 'Check campaign settings, targeting, and landing pages for these campaigns',
            affected: campaignsWithNoConversions
        });
    }
    
    // Check campaigns missing primary conversions
    primaryConversions.forEach(primaryConv => {
        const campaignsWithoutPrimary = Object.entries(results.summary.campaignPerformance)
            .filter(([_, stats]) => {
                const convStats = stats.conversionActions[primaryConv];
                return !convStats || convStats.conversions === 0;
            })
            .map(([name]) => name);
        
        if (campaignsWithoutPrimary.length > 0) {
            actionItems.push({
                priority: 'MEDIUM',
                type: 'Missing Primary Conversion',
                action: `Review ${campaignsWithoutPrimary.length} campaign(s) without ${primaryConv}`,
                tip: `Check why these campaigns aren't generating this primary conversion type`,
                affected: campaignsWithoutPrimary
            });
        }
    });
    
    // Check for conversion value opportunities
    const campaignsWithoutValues = Object.entries(results.summary.campaignPerformance)
        .filter(([_, stats]) => stats.value === 0 && stats.conversions > 0)
        .map(([name]) => name);
    
    if (campaignsWithoutValues.length > 0) {
        actionItems.push({
            priority: 'MEDIUM',
            type: 'Missing Values',
            action: `Set conversion values for ${campaignsWithoutValues.length} converting campaign(s)`,
            tip: 'Adding conversion values will help optimize campaign performance',
            affected: campaignsWithoutValues
        });
    }
    
    // Check for uneven conversion distribution
    const totalConversions = Object.values(results.summary.campaignPerformance)
        .reduce((sum, stats) => sum + stats.conversions, 0);
    
    const highPerformingCampaigns = Object.entries(results.summary.campaignPerformance)
        .filter(([_, stats]) => (stats.conversions / totalConversions) > 0.8)
        .map(([name]) => name);
    
    if (highPerformingCampaigns.length > 0) {
        actionItems.push({
            priority: 'MEDIUM',
            type: 'Campaign Distribution',
            action: `Review budget allocation across campaigns`,
            tip: 'Some campaigns are generating most conversions. Consider redistributing budget or applying successful strategies to other campaigns',
            affected: highPerformingCampaigns.map(campaign => 
                `${campaign} (Dominant conversion source)`
            )
        });
    }
    
    if (actionItems.length === 0) {
        return `
            <div class="action-plan success">
                <h2>🎉 Congratulations!</h2>
                <p>All campaigns are performing well across all primary conversion goals. Keep monitoring performance and testing new opportunities.</p>
            </div>
        `;
    }
    
    return `
        <div class="action-plan">
            <h2>📋 Campaign Action Plan</h2>
            <p>Here are the recommended steps to improve campaign performance across your primary conversion goals:</p>
            
            <h3>High Priority Actions</h3>
            <ul class="action-items high-priority">
                ${actionItems
                    .filter(item => item.priority === 'HIGH')
                    .map(item => `
                        <li>
                            <strong>${item.type}:</strong>
                            ${item.action}
                            <br>
                            <span class="quick-tip">💡 Quick Tip: ${item.tip}</span>
                            ${item.affected ? `
                                <br>
                                <span class="affected-items">Affected campaigns: ${item.affected.join(', ')}</span>
                            ` : ''}
                        </li>
                    `).join('')}
            </ul>
            
            <h3>Medium Priority Actions</h3>
            <ul class="action-items medium-priority">
                ${actionItems
                    .filter(item => item.priority === 'MEDIUM')
                    .map(item => `
                        <li>
                            <strong>${item.type}:</strong>
                            ${item.action}
                            <br>
                            <span class="quick-tip">💡 Quick Tip: ${item.tip}</span>
                            ${item.affected ? `
                                <br>
                                <span class="affected-items">Affected campaigns: ${item.affected.join(', ')}</span>
                            ` : ''}
                        </li>
                    `).join('')}
            </ul>
        </div>
    `;
}

function getEmailStyles() {
    return `
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 20px;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background: #fff;
            }
            h1 {
                color: #2c5282;
                margin-bottom: 20px;
                border-bottom: 2px solid #edf2f7;
                padding-bottom: 10px;
            }
            h2 {
                color: #2d3748;
                font-size: 1.5em;
                margin-top: 30px;
            }
            h3 {
                color: #2d3748;
                font-size: 1.2em;
                margin-top: 25px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
                font-size: 0.9em;
            }
            th, td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #edf2f7;
            }
            th {
                background: #f8fafc;
                font-weight: bold;
            }
            .period-row {
                background-color: #f8fafc;
            }
            .period-indicator {
                font-style: italic;
                color: #718096;
            }
            .good {
                color: #2f855a;
            }
            .warning {
                color: #d97706;
            }
            .conversion-totals {
                margin-top: 30px;
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
            }
            .action-plan {
                margin-top: 40px;
                padding: 20px;
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .action-plan h2 {
                color: #2c5282;
                margin-bottom: 15px;
            }
            .action-plan h3 {
                color: #2d3748;
                margin: 25px 0 15px 0;
            }
            .action-plan p {
                color: #4a5568;
                margin-bottom: 20px;
            }
            .action-items {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .action-items li {
                margin: 15px 0;
                padding: 15px;
                border-radius: 6px;
                background: #f8fafc;
            }
            .action-items.high-priority li {
                border-left: 4px solid #e53e3e;
                background: #fff5f5;
            }
            .action-items.medium-priority li {
                border-left: 4px solid #d69e2e;
                background: #fffff0;
            }
            .quick-tip {
                display: block;
                margin-top: 8px;
                color: #718096;
                font-style: italic;
            }
            .affected-items {
                display: block;
                margin-top: 8px;
                color: #4a5568;
                font-size: 0.9em;
            }
            .action-plan.success {
                background: #f0fff4;
                border: 1px solid #c6f6d5;
            }
            .action-plan.success h2 {
                color: #2f855a;
            }
            .action-plan.success p {
                color: #276749;
            }
            .conversion-details {
                font-size: 0.9em;
                color: #666;
                line-height: 1.4;
            }
            .campaign-performance {
                margin: 20px 0;
            }
        </style>
    `;
}

function sendEmail(htmlBody) {
    Logger.log('📧 Attempting to send email...');
    try {
        MailApp.sendEmail({
            to: CONFIG.EMAIL.RECIPIENT,
            subject: `${CONFIG.EMAIL.SUBJECT_PREFIX} - ${new Date().toLocaleDateString()}`,
            htmlBody: htmlBody
        });
        Logger.log('✅ Conversion audit report email sent successfully');
    } catch (e) {
        Logger.log('❌ Error sending email: ' + e);
    }
}

function sendErrorNotification(error) {
    Logger.log('⚠️ Sending error notification...');
    try {
        MailApp.sendEmail({
            to: CONFIG.EMAIL.RECIPIENT,
            subject: "Error in Conversion Audit Script",
            body: "An error occurred while running the conversion audit script:\n\n" + error.toString()
        });
        Logger.log('✅ Error notification sent');
    } catch (e) {
        Logger.log('❌ Failed to send error notification: ' + e);
    }
}

function getDateRange() {
    if (CONFIG.AUDIT_PERIOD.START_DATE && CONFIG.AUDIT_PERIOD.END_DATE) {
        return `segments.date BETWEEN '${CONFIG.AUDIT_PERIOD.START_DATE}' AND '${CONFIG.AUDIT_PERIOD.END_DATE}'`;
    } else {
        // Calculate dates for the period
        var endDate = new Date();
        var startDate = new Date();
        startDate.setDate(endDate.getDate() - CONFIG.AUDIT_PERIOD.DAYS);
        
        // Format dates as YYYY-MM-DD
        var formattedStartDate = startDate.toISOString().split('T')[0];
        var formattedEndDate = endDate.toISOString().split('T')[0];
        
        return `segments.date BETWEEN '${formattedStartDate}' AND '${formattedEndDate}'`;
    }
} 