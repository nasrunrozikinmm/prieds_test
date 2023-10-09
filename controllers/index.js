const stock_read_log = require("../models/stock_read_log");

async function edit_repcking(req, res) {
  const { company_id, payload, reject_qr_list, new_qr_list } = req.body;
  try {
    const all_data = await stock_read_log.find({ company_id });
    const data_by_payload = await stock_read_log.findOne({
      company_id,
      payload,
    });

    if (!data_by_payload) {
      res.json({ statusCode: 404, message: "stock not found!" });
      return;
    }

    for (const item of all_data) {
      const { qr_list } = item;
      //  find rejected list
      reject_qr_list?.forEach(async (e) => {
        if (item?.payload === e.payload) {
          //   console.log(item, "itemmmmmmmmmmmmmm");
          item.status = 0;
          item.status_qc = 1;
          item.last_updated = new Date();
          item.last_synced = new Date();
          update_function(company_id, item);
        }
      });
      new_qr_list?.forEach(async (e) => {
        if (item.payload === e.payload) {
          const payload = update_payload(item);
          data_by_payload.qr_list.push(payload);
        }
      });
      reduce_qr_list(item, new_qr_list);
    }

    reduce_qr_list(data_by_payload, reject_qr_list);
    return res.status(201).json({
      statusCode: 201,
      message: "edit-repacking-data successfully",
      data: data_by_payload,
      count: data_by_payload.qr_list.length,
    });
  } catch (error) {
    console.log("error from edit data packing", error);
  }
}
const update_function = async (company_id, data) => {
  await stock_read_log.updateOne({ company_id, _id: data._id }, { $set: data });
};

const update_payload = (item) => {
  const { _doc } = { ...item };
  _doc.status = 1;
  _doc.status_qc = 0;
  _doc.qr_count = 1;
  _doc.last_updated = new Date();
  _doc.last_synced = new Date();
  delete _doc.qty;
  delete _doc.stock_type;
  return _doc;
};

const reduce_qr_list = (item, arr2) => {
  const new_list = item.qr_list?.filter(
    (item1) => !arr2.some((item2) => item1.payload === item2.payload)
  );
  item.qr_list = new_list;
  item.qty = sum_qty(item.qr_list);
  update_function(item.company_id, item);
};

const sum_qty = (data = []) => {
  let total = 1;
  if (data.length > 0) {
    total = data.length;
  }
  return total;
};

const find_and_remove = (props) => {
  let { qr_list, new_qr_list } = props;
  const new_list = [];
  qr_list = qr_list?.filter((item1) => {
    if (!new_qr_list.some((item2) => item1.payload === item2.payload)) {
      //   console.log(item1, "itemmmmmmmmmmmmmmmmmmmmmmmmmm");
      new_list.push(item1);
    }
  });
  console.log(new_list);
  return { new_list };
};
module.exports = {
  edit_repcking,
};
