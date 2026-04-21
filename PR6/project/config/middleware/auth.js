function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Необхідна автентифікація' });
}

function hasRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Доступ заборонено (недостатньо прав)' });
        }
        next();
    };
}

module.exports = { isAuthenticated, hasRole };