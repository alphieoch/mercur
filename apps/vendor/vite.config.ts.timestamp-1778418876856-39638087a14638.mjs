// vite.config.ts
import { defineConfig, loadEnv } from "file:///Users/alphie/Project%20Farmhouse/mercur/node_modules/.bun/vite@5.4.21+7415f5c55b0e9667/node_modules/vite/dist/node/index.js";
import react from "file:///Users/alphie/Project%20Farmhouse/mercur/node_modules/.bun/@vitejs+plugin-react@4.7.0+f04d32485349976f/node_modules/@vitejs/plugin-react/dist/index.js";
import { mercurDashboardPlugin } from "file:///Users/alphie/Project%20Farmhouse/mercur/packages/dashboard-sdk/dist/index.cjs";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_MERCUR_BACKEND_URL || env.MERCUR_BACKEND_URL;
  return {
    plugins: [
      react(),
      mercurDashboardPlugin({
        medusaConfigPath: "../api/medusa-config.ts",
        ...backendUrl ? { backendUrl } : {},
        components: {
          StoreSetup: "components/store-setup/store-setup"
        }
      })
    ]
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYWxwaGllL1Byb2plY3QgRmFybWhvdXNlL21lcmN1ci9hcHBzL3ZlbmRvclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2FscGhpZS9Qcm9qZWN0IEZhcm1ob3VzZS9tZXJjdXIvYXBwcy92ZW5kb3Ivdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2FscGhpZS9Qcm9qZWN0JTIwRmFybWhvdXNlL21lcmN1ci9hcHBzL3ZlbmRvci92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5pbXBvcnQgeyBtZXJjdXJEYXNoYm9hcmRQbHVnaW4gfSBmcm9tICdAbWVyY3VyanMvZGFzaGJvYXJkLXNkaydcblxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpXG4gIGNvbnN0IGJhY2tlbmRVcmwgPVxuICAgIGVudi5WSVRFX01FUkNVUl9CQUNLRU5EX1VSTCB8fCBlbnYuTUVSQ1VSX0JBQ0tFTkRfVVJMXG5cbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBbXG4gICAgICByZWFjdCgpLFxuICAgICAgbWVyY3VyRGFzaGJvYXJkUGx1Z2luKHtcbiAgICAgICAgbWVkdXNhQ29uZmlnUGF0aDogJy4uL2FwaS9tZWR1c2EtY29uZmlnLnRzJyxcbiAgICAgICAgLi4uKGJhY2tlbmRVcmwgPyB7IGJhY2tlbmRVcmwgfSA6IHt9KSxcbiAgICAgICAgY29tcG9uZW50czoge1xuICAgICAgICAgIFN0b3JlU2V0dXA6ICdjb21wb25lbnRzL3N0b3JlLXNldHVwL3N0b3JlLXNldHVwJyxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgIF0sXG4gIH1cbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTBVLFNBQVMsY0FBYyxlQUFlO0FBQ2hYLE9BQU8sV0FBVztBQUNsQixTQUFTLDZCQUE2QjtBQUd0QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDM0MsUUFBTSxhQUNKLElBQUksMkJBQTJCLElBQUk7QUFFckMsU0FBTztBQUFBLElBQ0wsU0FBUztBQUFBLE1BQ1AsTUFBTTtBQUFBLE1BQ04sc0JBQXNCO0FBQUEsUUFDcEIsa0JBQWtCO0FBQUEsUUFDbEIsR0FBSSxhQUFhLEVBQUUsV0FBVyxJQUFJLENBQUM7QUFBQSxRQUNuQyxZQUFZO0FBQUEsVUFDVixZQUFZO0FBQUEsUUFDZDtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
