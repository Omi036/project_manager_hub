const { ProjectsManager } = require("./managers/projects");
const { UsersManager } = require("./managers/users");
const { DiscussionsManager } = require("./managers/discussions");
const { NewsManager } = require("./managers/news");

function createModelRouter() {
    const router = express.Router();

    const projectsManager = new ProjectsManager(pool);
    const usersManager = new UsersManager(pool);
    const discussionsManager = new DiscussionsManager(pool);
    const newsManager = new NewsManager(pool);
    
    return router;
}

exports.createModelRouter = createModelRouter;