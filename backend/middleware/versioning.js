/**
 * API Versioning Middleware
 * 
 * Handles API versioning through Accept headers or URL path
 * Supports:
 * - URL versioning: /api/v1/users
 * - Header versioning: Accept: application/vnd.digis.v1+json
 */

const DEFAULT_VERSION = 'v1';
const SUPPORTED_VERSIONS = ['v1'];

/**
 * Extract version from Accept header
 * Example: application/vnd.digis.v1+json
 */
const getVersionFromHeader = (acceptHeader) => {
  if (!acceptHeader) return null;
  
  const match = acceptHeader.match(/application\/vnd\.digis\.(v\d+)\+json/);
  return match ? match[1] : null;
};

/**
 * Extract version from URL path
 * Example: /api/v1/users
 */
const getVersionFromPath = (path) => {
  const match = path.match(/^\/api\/(v\d+)\//);
  return match ? match[1] : null;
};

/**
 * Version detection middleware
 */
const detectVersion = (req, res, next) => {
  // Try to get version from URL path first
  let version = getVersionFromPath(req.path);
  
  // If not in path, try Accept header
  if (!version) {
    version = getVersionFromHeader(req.get('Accept'));
  }
  
  // Default to v1 if no version specified
  if (!version) {
    version = DEFAULT_VERSION;
  }
  
  // Validate version
  if (!SUPPORTED_VERSIONS.includes(version)) {
    return res.status(400).json({
      error: 'Unsupported API version',
      message: `Version ${version} is not supported`,
      supportedVersions: SUPPORTED_VERSIONS,
      currentVersion: DEFAULT_VERSION
    });
  }
  
  // Attach version to request
  req.apiVersion = version;
  
  // Add version to response headers
  res.setHeader('X-API-Version', version);
  
  next();
};

/**
 * Route to correct version handler
 */
const routeVersion = (versions) => {
  return (req, res, next) => {
    const version = req.apiVersion || DEFAULT_VERSION;
    const handler = versions[version];
    
    if (!handler) {
      return res.status(501).json({
        error: 'Not implemented',
        message: `This endpoint is not available in version ${version}`,
        availableVersions: Object.keys(versions)
      });
    }
    
    handler(req, res, next);
  };
};

/**
 * Deprecation warning middleware
 */
const deprecationWarning = (deprecatedIn, removeIn, alternativeEndpoint) => {
  return (req, res, next) => {
    res.setHeader('X-API-Deprecation-Warning', 
      `This endpoint is deprecated in ${deprecatedIn} and will be removed in ${removeIn}. Use ${alternativeEndpoint} instead.`
    );
    res.setHeader('X-API-Deprecation-Date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString());
    res.setHeader('Sunset', new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toUTCString());
    next();
  };
};

/**
 * Version information endpoint handler
 */
const versionInfo = (req, res) => {
  res.json({
    current: DEFAULT_VERSION,
    supported: SUPPORTED_VERSIONS,
    deprecated: [],
    documentation: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3001/api-docs' 
      : 'https://api.digis.app/api-docs',
    changelog: 'https://github.com/digis/api/blob/main/CHANGELOG.md'
  });
};

module.exports = {
  detectVersion,
  routeVersion,
  deprecationWarning,
  versionInfo,
  DEFAULT_VERSION,
  SUPPORTED_VERSIONS
};