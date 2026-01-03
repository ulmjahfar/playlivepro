module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Ignore warnings about missing source maps from node_modules
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        {
          module: /node_modules/,
          message: /Failed to parse source map/,
        },
        {
          module: /html2pdf\.js/,
        },
        {
          module: /socket\.io-client/,
        },
        {
          message: /ENOENT.*socket\.io-client/,
        },
      ];

      // Find and modify source-map-loader rules to exclude socket.io-client
      const findAndModifySourceMapLoader = (rules) => {
        if (!Array.isArray(rules)) return;
        
        rules.forEach((rule) => {
          // Handle rules with 'use' array
          if (rule.use && Array.isArray(rule.use)) {
            rule.use.forEach((use) => {
              if (use.loader && use.loader.includes('source-map-loader')) {
                // Exclude socket.io-client from source-map-loader
                if (!rule.exclude) {
                  rule.exclude = [];
                }
                if (Array.isArray(rule.exclude)) {
                  const hasSocketIO = rule.exclude.some(
                    expr => expr && expr.toString && expr.toString().includes('socket.io-client')
                  );
                  if (!hasSocketIO) {
                    rule.exclude.push(/socket\.io-client/);
                  }
                } else {
                  rule.exclude = [rule.exclude, /socket\.io-client/];
                }
              }
            });
          }
          
          // Handle oneOf rules (Create React App structure)
          if (rule.oneOf && Array.isArray(rule.oneOf)) {
            findAndModifySourceMapLoader(rule.oneOf);
          }
        });
      };

      if (webpackConfig.module && webpackConfig.module.rules) {
        findAndModifySourceMapLoader(webpackConfig.module.rules);
      }

      return webpackConfig;
    },
  },
};

