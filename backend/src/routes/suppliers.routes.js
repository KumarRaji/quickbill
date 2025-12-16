const router = require("express").Router();
const c = require("../controllers/suppliers.controller");

router.get("/", c.listSuppliers);        // ?search=&page=&pageSize=
router.get("/:id", c.getSupplierById);   // optional
router.post("/", c.createSupplier);
router.patch("/:id", c.updateSupplier);
router.delete("/:id", c.deleteSupplier);

module.exports = router;
