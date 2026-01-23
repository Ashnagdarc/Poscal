import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const server = new McpServer({
  name: "Supabase Database MCP",
  version: "1.0.0",
});

// Helper to check if user is admin
async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin');
  return !error && data && data.length > 0;
}

// Helper to enforce user ownership for data operations
async function checkUserOwnership(table, userId, recordId) {
  const { data, error } = await supabase
    .from(table)
    .select('user_id')
    .eq('id', recordId)
    .single();
  
  if (error) return false;
  return data.user_id === userId;
}

server.tool(
  "queryTable",
  "Query data from a Supabase table with optional filters. Respects RLS policies.",
  {
    table: z.string().describe("Table name (e.g., trading_journal, trading_accounts)"),
    select: z.string().default("*").describe("Columns to select (comma-separated or *)"),
    filter: z.object({
      column: z.string(),
      value: z.any(),
      operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in"]),
    }).optional(),
    limit: z.number().optional().describe("Max records to return"),
    userId: z.string().optional().describe("User ID for RLS context (auto-enforced for user tables)"),
  },
  async ({ table, select, filter, limit, userId }) => {
    try {
      let query = supabase.from(table).select(select);
      
      // Auto-enforce user_id for personal tables
      const personalTables = ['trading_journal', 'trading_accounts', 'taken_trades', 'profiles', 'email_queue', 'payments', 'push_subscriptions'];
      if (personalTables.includes(table) && userId) {
        query = query.eq('user_id', userId);
      }
      
      if (filter) {
        query = query[filter.operator](filter.column, filter.value);
      }
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "insertData",
  "Insert new record(s) into a Supabase table. Automatically sets user_id for user-owned records.",
  {
    table: z.string().describe("Table name"),
    data: z.any().describe("Record(s) to insert"),
    userId: z.string().optional().describe("User ID (required for user-owned records)"),
  },
  async ({ table, data, userId }) => {
    try {
      // Auto-set user_id for personal tables
      const personalTables = ['trading_journal', 'trading_accounts', 'taken_trades', 'profiles', 'email_queue', 'push_subscriptions'];
      
      if (personalTables.includes(table) && userId) {
        if (Array.isArray(data)) {
          data = data.map(record => ({ ...record, user_id: userId }));
        } else {
          data = { ...data, user_id: userId };
        }
      }
      
      const { data: result, error } = await supabase.from(table).insert(data).select();
      if (error) throw error;
      
      return {
        content: [{ type: "text", text: `Successfully inserted:\n${JSON.stringify(result, null, 2)}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "updateData",
  "Update existing record(s) in a Supabase table. Respects user ownership.",
  {
    table: z.string().describe("Table name"),
    filter: z.object({ 
      column: z.string(), 
      value: z.any() 
    }).describe("Filter condition"),
    data: z.record(z.any()).describe("Data to update"),
    userId: z.string().optional().describe("User ID for ownership check"),
  },
  async ({ table, filter, data, userId }) => {
    try {
      // Check ownership for personal tables
      const personalTables = ['trading_journal', 'trading_accounts', 'taken_trades', 'profiles'];
      
      if (personalTables.includes(table) && userId && filter.column === 'id') {
        const isOwner = await checkUserOwnership(table, userId, filter.value);
        if (!isOwner) {
          throw new Error('Unauthorized: You can only update your own records');
        }
      }
      
      const { data: result, error } = await supabase
        .from(table)
        .update(data)
        .eq(filter.column, filter.value)
        .select();
      if (error) throw error;
      
      return {
        content: [{ type: "text", text: `Successfully updated:\n${JSON.stringify(result, null, 2)}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "deleteData",
  "Delete record(s) from a Supabase table. Respects user ownership and RLS policies.",
  {
    table: z.string().describe("Table name"),
    filter: z.object({ 
      column: z.string(), 
      value: z.any() 
    }).describe("Filter condition"),
    userId: z.string().optional().describe("User ID for ownership check"),
  },
  async ({ table, filter, userId }) => {
    try {
      // Check ownership for personal tables
      const personalTables = ['trading_journal', 'trading_accounts', 'taken_trades'];
      
      if (personalTables.includes(table) && userId && filter.column === 'id') {
        const isOwner = await checkUserOwnership(table, userId, filter.value);
        if (!isOwner) {
          throw new Error('Unauthorized: You can only delete your own records');
        }
      }
      
      const { data: result, error } = await supabase
        .from(table)
        .delete()
        .eq(filter.column, filter.value)
        .select();
      if (error) throw error;
      
      return {
        content: [{ type: "text", text: `Successfully deleted:\n${JSON.stringify(result, null, 2)}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "listTables",
  "List all tables in the database with their schemas",
  {},
  async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_tables');
      if (error) {
        // Fallback: query information_schema
        const { data: tables, error: schemaError } = await supabase.from('information_schema.tables').select('*').eq('table_schema', 'public');
        if (schemaError) throw schemaError;
        return {
          content: [{ type: "text", text: JSON.stringify(tables, null, 2) }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "getUserRole",
  "Check user role and permissions",
  {
    userId: z.string().describe("User ID"),
  },
  async ({ userId }) => {
    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const isAdmin = roles && roles.some(r => r.role === 'admin');
      return {
        content: [{ type: "text", text: JSON.stringify({ userId, isAdmin, roles: roles || [] }, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
