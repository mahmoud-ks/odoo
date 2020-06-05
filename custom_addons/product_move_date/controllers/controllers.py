# -*- coding: utf-8 -*-
# from odoo import http


# class ProductMoveDate(http.Controller):
#     @http.route('/product_move_date/product_move_date/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/product_move_date/product_move_date/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('product_move_date.listing', {
#             'root': '/product_move_date/product_move_date',
#             'objects': http.request.env['product_move_date.product_move_date'].search([]),
#         })

#     @http.route('/product_move_date/product_move_date/objects/<model("product_move_date.product_move_date"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('product_move_date.object', {
#             'object': obj
#         })
